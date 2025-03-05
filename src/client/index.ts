import {
    CommentSubmit,
    CommentUpdate,
    PostSubmit,
    PostUpdate,
    CommentDelete,
    PostDelete,
    ModAction
} from "@devvit/protos";
import { ScheduledJobEvent, TriggerContext } from "@devvit/public-api";
import { RK_TRANSMISSION_QUEUE, SUPPORTED_MOD_ACTIONS, WP_OPEN_MOD_EVENTS } from "../constants.js";
import { now } from "../temporal.js";
import { ModActionType, Nothing } from "../types.js";
import { AppSetting, isClient } from "../settings.js";
import { ProtocolEvent, ProtocolMessage } from "../protocol.js";
import { getModeratedThingId, isCommentDelete, isCommentSubmit, isPostSubmit, sha256 } from "./utility.js";
import { isEventDuplicated } from "../utility.js";
import { getBasicUserInfoByUsername, getCurrentSubredditName, updateWikiPage } from "../reddit.js";
import { T1ID, T3ID, T5ID } from "@devvit/shared-types/tid.js";

export const onCommentChanged = async (event: CommentSubmit | CommentUpdate, context: TriggerContext) => {
    const iAmTheClient = await isClient(context);
    if (!iAmTheClient) return; // silently ignore events if we're not in client mode

    if (!event.comment || !event.author || !event.subreddit) {
        console.error('onCommentChanged', 'unexpectedly encountered malformed comment event');
        return;
    }

    const duplicated = await isEventDuplicated(event.comment.id, context);
    if (isCommentSubmit(event) && duplicated) {
        console.debug('onCommentChanged', `commentsubmit ${event.comment.id} is a duplicate`);
        return;
    }

    const ts = event.comment.lastModifiedAt > 0 ? event.comment.lastModifiedAt : event.comment.createdAt;
    const message: ProtocolMessage = {
        type: ProtocolEvent.CommentChanged,
        v: 2,
        tid: event.comment.id as T1ID,
        sid: event.subreddit.id as T5ID,
        ts
    };

    await context.redis.zAdd(RK_TRANSMISSION_QUEUE, {
        member: JSON.stringify(message),
        score: ts
    });
    console.debug('onCommentChanged', `queued commentchanged ${event.comment.id}`);
};

export const onPostChanged = async (event: PostSubmit | PostUpdate, context: TriggerContext) => {
    const iAmTheClient = await isClient(context);
    if (!iAmTheClient) return; // silently ignore events if we're not in client mode

    if (!event.post || !event.author || !event.subreddit) {
        console.error('onPostChanged', 'unexpectedly encountered malformed post event');
        return;
    }

    const duplicated = await isEventDuplicated(event.post.id, context);
    if (isPostSubmit(event) && duplicated) {
        console.debug('onPostChanged', `postsubmit ${event.post.id} is a duplicate`);
        return;
    }

    const ts = event.post.updatedAt > 0 ? event.post.updatedAt : event.post.createdAt;
    const message: ProtocolMessage = {
        type: ProtocolEvent.PostChanged,
        v: 2,
        tid: event.post.id as T3ID,
        sid: event.subreddit.id as T5ID,
        ts
    };

    await context.redis.zAdd(RK_TRANSMISSION_QUEUE, {
        member: JSON.stringify(message),
        score: ts
    });
    console.debug('onPostChanged', `queued postchanged ${event.post.id}`);
};

export const onThingDeleted = async (event: CommentDelete | PostDelete, context: TriggerContext) => {
    const iAmTheClient = await isClient(context);
    if (!iAmTheClient) return; // silently ignore events if we're not in client mode
    if (event.source !== 1) {
        console.debug('onThingDeleted', `i observed a deleted thing, but it was not deleted by its creator, so i will look the other way`);
        return; // silently ignore deletions that are not user-generated
    }

    if (!event.subreddit) {
        console.error('onThingDeleted', 'unexpectedly encountered malformed deletion event');
        return;
    }

    const ts = event.deletedAt?.getTime() ?? now();

    let message: ProtocolMessage;
    if (isCommentDelete(event)) {
        console.debug('onThingDeleted', `deleted thing is a comment`);
        message = {
            type: ProtocolEvent.CommentDelete,
            v: 2,
            tid: event.commentId as T1ID,
            sid: event.subreddit.id as T5ID,
            ts
        };
    } else {
        console.debug('onThingDeleted', `deleted thing is a post`);
        message = {
            type: ProtocolEvent.PostDelete,
            v: 2,
            tid: event.postId as T3ID,
            sid: event.subreddit.id as T5ID,
            ts
        };
    }

    await context.redis.zAdd(RK_TRANSMISSION_QUEUE, {
        member: JSON.stringify(message),
        score: ts
    });
    console.debug('onThingDeleted', `queued thingdeleted ${message.tid}`);
};

export const onModAction = async (event: ModAction, context: TriggerContext) => {
    const iAmTheClient = await isClient(context);
    if (!iAmTheClient) return; // silently ignore events if we're not in client mode

    if (!event.action || !event.moderator || !event.subreddit || !event.targetUser) {
        console.error('onModAction', 'unexpectedly encountered malformed modaction event');
        return;
    }

    let id = await sha256(event);
    const duplicated = await isEventDuplicated(id, context);
    if (duplicated) {
        console.debug('onModAction', `modaction ${id} is a duplicate`);
        return;
    }

    if (!SUPPORTED_MOD_ACTIONS.includes(event.action)) {
        console.debug('onModAction', `modaction ${event.action} is not supported`);
        return;
    }

    const admins = await context.settings.get<boolean>(AppSetting.RecordAdminActions) ?? true;
    const moderator = await getBasicUserInfoByUsername(event.moderator.name, context);
    if (!admins && moderator && moderator.isAdmin) {
        console.debug('onModAction', `modaction ${event.action} by ${event.moderator.id} is excluded`);
        return;
    }

    const automod = await context.settings.get<boolean>(AppSetting.RecordAutoModeratorActions) ?? false;
    if (!automod && event.moderator.name === 'AutoModerator') {
        console.debug('onModAction', `modaction ${event.action} by ${event.moderator.id} is excluded`);
        return;
    }

    // excluded moderators is a comma-separated list of usernames, validated at time of submission
    // we can search within that list rather than splitting
    const mods = await context.settings.get<string>(AppSetting.ExcludedModerators);
    if (mods && mods.includes(event.moderator.name)) {
        console.debug('onModAction', `modaction ${event.action} by ${event.moderator.id} is excluded`);
        return;
    }

    // excluded users is a comma-separated list of usernames, validated at time of submission
    // we can search within that list rather than splitting
    const users = await context.settings.get<string>(AppSetting.ExcludedUsers);
    if (users && (users.includes(event.targetUser.name) || users.includes(event.moderator.name))) {
        console.debug('onModAction', `modaction ${event.action} on ${event.targetUser.id} by ${event.moderator.id} is excluded`);
        return;
    }

    const actions = await context.settings.get<string[]>(AppSetting.ModerationActions)
    if (!actions || !actions.includes(event.action)) {
        console.debug('onModAction', `modaction ${event.action} is not in the list of actions to forward`);
        return;
    }

    const subredditName = await getCurrentSubredditName(context);
    if (!subredditName) {
        throw new Error(`onModAction, i couldn't work out where i am - is reddit down?`);
    }

    const subredditModTeam = `${subredditName}-ModTeam`;
    if (event.moderator.name === subredditModTeam) {
        console.debug('onModAction', `modaction ${event.action} by ${event.moderator.id} is excluded`);
        return;
    }

    const ts = event.actionedAt?.getTime() ?? now();
    console.debug('onModAction', `timestamp is ${ts}`);

    const tid = await getModeratedThingId(event, context);
    console.debug('onModAction', `got moderated thing id ${tid}`);

    // forward-looking support for modaction id
    let mai: string | undefined;
    if ('id' in event) {
        mai = (event.id as string).replace("ModAction_", "");
    }

    const ctx = await context.settings.get<boolean>(AppSetting.IncludeContext) ?? false;
    const message: ProtocolMessage = {
        type: ProtocolEvent.ModAction,          // message type, alway "modAction"
        v: 2,                                   // protocol version, always 2
        tid,                                    // tX of moderated thing
        sid: event.subreddit.id as T5ID, // t5 of subreddit
        ts,                                     // timestamp of the event in ms since epoch
        sub: event.action as ModActionType,     // type of mod action taken
        mod: moderator.id,                      // t2 of the actor
        ctx,                                    // true if context should be recorded
        mai                                     // guid of the mod action
    };

    await context.redis.zAdd(RK_TRANSMISSION_QUEUE, {
        member: JSON.stringify(message),
        score: ts
    });
    console.debug('onModAction', `queued modaction ${message.tid}`);
};

export const onForwardEvents = async (event: ScheduledJobEvent<Nothing>, context: TriggerContext) => {
    const destination = await context.settings.get(AppSetting.TargetSubreddit) as string | undefined;
    if (!destination || destination.trim().length === 0) {
        // the destination is not configured, so we're not forwarding anything
        // this could be an error, but is also an expected state for the server
        // if the destination is set, then we assume we're forwarding
        console.debug('onForwardEvents', `the target subreddit is not configured, and i assume i am the server, so i will not forward anything`);
        return;
    }

    const members = await context.redis.zRange(RK_TRANSMISSION_QUEUE, 0, now(), { by: 'score' });
    if (members.length === 0) {
        console.debug('onForwardEvents', `there are no events to forward`);
        return;
    }
    await context.redis.zRem(RK_TRANSMISSION_QUEUE, members.map(x => x.member));
    console.debug('onForwardEvents', `cleared ${members.length} events from the queue`);

    let content = '';
    for (const member of members) {
        content += `${member.member}\n`;
    }

    const page = await updateWikiPage({
        subredditName: destination,
        page: WP_OPEN_MOD_EVENTS,
        content
    }, context);

    if (!page) {
        throw new Error(`failed to update the wiki page for ${WP_OPEN_MOD_EVENTS}`);
    }

    console.debug('onForwardEvents', `forwarded ${members.length} events to https://reddit.com/r/${destination}/mod/wiki/${WP_OPEN_MOD_EVENTS}`);
};
