import { CommentSubmit, CommentUpdate, PostSubmit, PostUpdate, CommentDelete, PostDelete, ModAction } from "@devvit/protos";
import { CommentID, PostID, ThingID, UserID } from "../types.js";

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

    console.debug(`hashed data, got ${hash}`);
    return hash;
};

export const getModeratedThingId = (event: ModAction): ThingID => {
    const action = event.action;
    if (!action) throw new Error('missing action in mod action event');

    if (action.endsWith("comment")) {
        if (!event.targetComment) throw new Error('missing targetComment in mod action event');

        console.debug(`moderated thing is a comment`);
        return event.targetComment.id as CommentID;
    }

    if (action.endsWith("link")) {
        if (!event.targetPost) throw new Error('missing targetPost in mod action event');

        console.debug(`moderated thing is a post`);
        return event.targetPost.id as PostID;
    }

    if (action.endsWith("user")) {
        if (!event.targetUser) throw new Error('missing targetUser in mod action event');

        console.debug(`moderated thing is a user`);
        return event.targetUser.id as UserID;
    }

    if (action.endsWith("lock")) {
        // could be either a post or a comment.
        // the event populates both structures, but not the ids, so we'll check for the presence of a comment id
        if (event.targetComment?.id) {
            console.debug(`moderated thing is a comment`);
            return event.targetComment.id as CommentID;
        }
    
        // it's not a comment, which means it's a post, so make sure the post does in fact exist here
        if (!event.targetPost?.id) throw new Error('missing targetPost in mod action event');

        console.debug(`moderated thing is a post`);
        return event.targetPost.id as PostID;
    }

    throw new Error(`unsupported action in mod action event: ${action}`);
};
