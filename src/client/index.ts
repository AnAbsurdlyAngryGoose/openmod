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
import { RK_LAST_KNOWN_SETTINGS, RK_TRANSMISSION_QUEUE, SJ_DELAYED_MOD_ACTION_PROCESSING, SUPPORTED_MOD_ACTIONS, WP_OPEN_MOD_EVENTS } from "../constants.js";
import { futureDate, now } from "../temporal.js";
import { ModActionType, Nothing } from "../types.js";
import { AppSetting, getAllSettings, isClient } from "../settings.js";
import { ModActionMessage, ProtocolEvent, ProtocolMessage, SettingsUpdatedMessage } from "../protocol.js";
import { getModeratedThingId, getModerationLogs, isCommentDelete, isCommentSubmit, isPostSubmit, sha256 } from "./utility.js";
import { hasFeatureParity, isEventDuplicated } from "../utility.js";
import { getBasicUserInfoByUsername, getCurrentSubredditName, updateWikiPage } from "../reddit.js";
import { T1ID, T3ID, T5ID } from "@devvit/shared-types/tid.js";
import { gzipSync, strFromU8, strToU8 } from "fflate";

type OnDelayedModActionData = {
    ts: number
    event: string
};

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

    // because we can't read the modlog on the other side, we need to defer processing of this event
    // so, what we do is json it up and stick it in redis, and then schedule a task to process it later
    const key = `delayed-mod-action:${id}`;
    await context.redis.set(key, JSON.stringify(event));
    await context.scheduler.runJob({
        name: SJ_DELAYED_MOD_ACTION_PROCESSING,
        data: {
            ts: event.actionedAt?.getTime() ?? now(),
            event: id
        },
        runAt: futureDate({ minutes: 1 })
    });
    console.debug('onModAction', `queued delayed processing of modaction ${id}`);
};

export const onForwardEvents = async (event: ScheduledJobEvent<Nothing>, context: TriggerContext) => {
    const settings = await getAllSettings(context)
    const destination = settings.targetSubreddit;
    if (!destination || destination.trim().length === 0) {
        // the destination is not configured, so we're not forwarding anything
        // this could be an error, but is also an expected state for the server
        // if the destination is set, then we assume we're forwarding
        console.debug('onForwardEvents', `the target subreddit is not configured, and i assume i am the server, so i will not forward anything`);
        return;
    }

    // new encryption/compression feature requires that the target subreddit is running the same version or newer
    const atParity = await hasFeatureParity(destination, context);
    if (!atParity) {
        console.debug('onForwardEvents', `the target subreddit is not running the same version as me, and i will pause forwarding activity until they are`);
        return;
    }

    // get the members..
    let members = await context.redis.zRange(RK_TRANSMISSION_QUEUE, 0, now(), { by: 'score' });

    // and then, if the settings have changed, add them to the queue
    const latestSettingsHash = await sha256(settings);
    const lastKnownSettingsHash = await context.redis.get(RK_LAST_KNOWN_SETTINGS);
    if (!lastKnownSettingsHash || lastKnownSettingsHash !== latestSettingsHash) {
        await context.redis.set(RK_LAST_KNOWN_SETTINGS, latestSettingsHash);
        await context.redis.expire(RK_LAST_KNOWN_SETTINGS, 60 * 60); // 60 minutes 

        const message: SettingsUpdatedMessage = {
            type: ProtocolEvent.SettingsUpdated,
            v: 3,
            ts: 0,
            sid: context.subredditId as T5ID,
            settings
        };
        members.push({ member: JSON.stringify(message), score: 0 });

        console.debug('onForwardEvents', `the settings have changed, so i will forward them to the target subreddit`);
    }

    // before checking to see if there's any work to do
    if (members.length === 0) {
        console.debug('onForwardEvents', `there are no events to forward`);
        return;
    }
    await context.redis.zRem(RK_TRANSMISSION_QUEUE, members.map(x => x.member));
    console.debug('onForwardEvents', `cleared ${members.length} events from the queue`);

    // for now we'll just compress the payload
    let joined = members.map(x => x.member).join('\n');
    const inBytes = strToU8(joined);
    const outBytes = gzipSync(inBytes, { level: 9 });
    const content = strFromU8(outBytes, true);

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

export const onDelayedModAction = async (scheduledJobEvent: ScheduledJobEvent<OnDelayedModActionData>, context: TriggerContext) => {
    const key = `delayed-mod-action:${scheduledJobEvent.data.event}`;

    const json = await context.redis.get(key);
    if (!json) {
        console.error('onDelayedModAction', `failed to retrieve delayed mod action data for ${scheduledJobEvent.data.event}`);
        return;
    }
    console.debug('onDelayedModAction', `retrieved delayed mod action ${scheduledJobEvent.data.event}`);

    await context.redis.del(key);
    console.debug('onDelayedModAction', `deleted delayed mod action ${scheduledJobEvent.data.event}`);

    const event = JSON.parse(json) as ModAction;

    // double check this here to satisfy the type system
    if (!event.action || !event.moderator || !event.subreddit || !event.targetUser) {
        console.error('onDelayedModAction', 'unexpectedly encountered malformed modaction event');
        return;
    }

    if (!SUPPORTED_MOD_ACTIONS.includes(event.action)) {
        console.debug('onDelayedModAction', `modaction ${event.action} is not supported for forwarding`);
        return;
    }

    const admins = await context.settings.get<boolean>(AppSetting.RecordAdminActions) ?? true;
    const moderator = await getBasicUserInfoByUsername(event.moderator.name, context);
    if (!admins && moderator && moderator.isAdmin) {
        console.debug('onDelayedModAction', `modaction ${event.action} by ${event.moderator.id} is excluded`);
        return;
    }

    const automod = await context.settings.get<boolean>(AppSetting.RecordAutoModeratorActions) ?? false;
    if (!automod && event.moderator.name === 'AutoModerator') {
        console.debug('onDelayedModAction', `modaction ${event.action} by ${event.moderator.id} is excluded`);
        return;
    }

    // excluded moderators is a comma-separated list of usernames, validated at time of submission
    // we can search within that list rather than splitting
    const mods = await context.settings.get<string>(AppSetting.ExcludedModerators);
    if (mods && mods.includes(event.moderator.name)) {
        console.debug('onDelayedModAction', `modaction ${event.action} by ${event.moderator.id} is excluded`);
        return;
    }

    // excluded users is a comma-separated list of usernames, validated at time of submission
    // we can search within that list rather than splitting
    const users = await context.settings.get<string>(AppSetting.ExcludedUsers);
    if (users && (users.includes(event.targetUser.name) || users.includes(event.moderator.name))) {
        console.debug('onDelayedModAction', `modaction ${event.action} on ${event.targetUser.id} by ${event.moderator.id} is excluded`);
        return;
    }

    const actions = await context.settings.get<string[]>(AppSetting.ModerationActions)
    if (!actions || !actions.includes(event.action)) {
        console.debug('onDelayedModAction', `modaction ${event.action} is not in the list of actions to forward`);
        return;
    }

    const subredditName = await getCurrentSubredditName(context);
    if (!subredditName) {
        throw new Error(`onDelayedModAction, i couldn't work out where i am - is reddit down?`);
    }

    const subredditModTeam = `${subredditName}-ModTeam`;
    if (event.moderator.name === subredditModTeam) {
        console.debug('onDelayedModAction', `modaction ${event.action} by ${event.moderator.id} is excluded`);
        return;
    }

    const ts = scheduledJobEvent.data.ts;
    console.debug('onDelayedModAction', `timestamp is ${ts}`);

    const tid = await getModeratedThingId(event, context);
    console.debug('onDelayedModAction', `got moderated thing id ${tid}`);

    const log = await getModerationLogs(tid, context);
    console.debug('onDelayedModAction', `got ${log.length} moderation logs for ${tid}`);

    const ctx = await context.settings.get<boolean>(AppSetting.IncludeContext) ?? false;
    const message: ModActionMessage = {
        type: ProtocolEvent.ModAction,          // message type, alway "modAction"
        v: 2,                                   // protocol version, always 2
        tid,                                    // tX of moderated thing
        sid: event.subreddit.id as T5ID,        // t5 of subreddit
        ts,                                     // timestamp of the event in ms since epoch
        sub: event.action as ModActionType,     // type of mod action taken
        mod: moderator.id,                      // t2 of the actor
        ctx,                                    // true if context should be recorded
        log                                     // array of mod logs for the moderated thing
    };

    const member = JSON.stringify(message);
    await context.redis.zAdd(RK_TRANSMISSION_QUEUE, {
        member,
        score: ts
    });
    console.debug('onDelayedModAction', `queued modaction ${message.tid}`);
};
