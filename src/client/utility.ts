import { CommentSubmit, CommentUpdate, PostSubmit, PostUpdate, CommentDelete, PostDelete, ModAction } from "@devvit/protos";;
import { getBasicUserInfoByUsername } from "../reddit.js";
import { TriggerContext } from "@devvit/public-api";
import { T1ID, T3ID, TID } from "@devvit/shared-types/tid.js";
import { ModActionType, ModLogEntry } from "../types.js";

export const isCommentSubmit = (event: CommentSubmit | CommentUpdate): event is CommentSubmit => {
    return !('previousBody' in event);
};

export const isPostSubmit = (event: PostSubmit | PostUpdate): event is PostSubmit => {
    return !('previousBody' in event);
};

export const isCommentDelete = (event: CommentDelete | PostDelete): event is CommentDelete => {
    return 'commentId' in event;
};

export const sha256 = async (data: any): Promise<string> => {
    const json = JSON.stringify(data);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(json);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    console.debug('sha256', `hashed data, got ${hash}`);
    return hash;
};

export const getModeratedThingId = async (event: ModAction, context: TriggerContext): Promise<TID> => {
    const action = event.action;
    if (!action) throw new Error('getModeratedThingId, modaction structure in unusable state: missing action field');

    if (action.endsWith("comment")) {
        if (!event.targetComment) throw new Error('getModeratedThingId, modaction structure in unusable state: missing targetComment field');

        console.debug('getModeratedThingId', `moderated thing is a comment`);
        return event.targetComment.id as T1ID;
    }

    if (action.endsWith("link")) {
        if (!event.targetPost) throw new Error('getModeratedThingId, modaction structure in unusable state: missing targetPost field');

        console.debug('getModeratedThingId', `moderated thing is a post`);
        return event.targetPost.id as T3ID;
    }

    if (action.endsWith("user") || action.includes("moderator") || action.endsWith("contributor")) {
        if (!event.targetUser) throw new Error('getModeratedThingId, modaction structure in unusable state: missing targetUser field');

        console.debug('getModeratedThingId', `moderated thing is a user`);

        // potentially, the moderated user is a special account, in which case the id may not be set
        // search it out by username and see what we get
        const user = await getBasicUserInfoByUsername(event.targetUser.name, context);
        return user.id;
    }

    if (action.endsWith("lock")) {
        // could be either a post or a comment.
        // the event populates both structures, but not the ids, so we'll check for the presence of a comment id
        if (event.targetComment?.id) {
            console.debug('getModeratedThingId', `moderated thing is a comment`);
            return event.targetComment.id as T1ID;
        }
    
        // it's not a comment, which means it's a post, so make sure the post does in fact exist here
        if (!event.targetPost?.id) throw new Error('getModeratedThingId, modaction structure in unusable state: missing targetPost field');

        console.debug('getModeratedThingId', `moderated thing is a post`);
        return event.targetPost.id as T3ID;
    }

    throw new Error(`getModeratedThingId, modaction structure in unusable state: unexpected action ${action}`);
};

export const getModerationLogs = async (tid: TID, context: TriggerContext): Promise<ModLogEntry[]> => {
    const logs = await context.reddit.getModerationLog({
        subredditName: await context.reddit.getCurrentSubredditName(),
        limit: 1000
    }).all();

    return logs.filter(log => log.target && log.target.id === tid).map(log => ({
        type: log.type as ModActionType,
        moderatorName: log.moderatorName,
        details: log.details,
        description: log.description
    }));
};
