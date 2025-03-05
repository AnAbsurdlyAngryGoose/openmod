import { TriggerContext } from "@devvit/public-api";
import { CommentChangedMessage } from "../../protocol.js";
import { isEventDuplicated } from "../../utility.js";
import { cacheComment, cacheUser, trackThing } from "../redis.js";
import { getBasicUserInfoByUsername, getCommentById } from "../../reddit.js";
import { T1ID } from "@devvit/shared-types/tid.js";

export const handleCommentChangedMessage = async (message: CommentChangedMessage, context: TriggerContext): Promise<void> => {
    const tid = message.tid;

    // need to pull the real comment so that we can navigate it
    // open mod respects the privacy of users, so if a user blocks open mod
    // this call will fail, and the event will be ignored
    const comment = await getCommentById(tid as T1ID, context);
    if (!comment) {
        console.debug('handleCommentChangedMessage', `comment ${tid} not found`);
        return;
    }

    // if the comment is new, but this is not the first time we've seen it, ignore it
    const isDuplicate = await isEventDuplicated(tid, context);
    if (!comment.edited && isDuplicate) {
        console.debug('handleCommentChangedMessage', `commentsubmit ${comment.id} is a duplicate`);
        return;
    }

    const author = await getBasicUserInfoByUsername(comment.authorName, context);
    if (!author) {
        console.debug('handleCommentChangedMessage', `user ${comment.authorId} not found`);
        return;
    }

    await cacheComment(comment, context);
    await cacheUser(author, context);
    await trackThing(comment, context);
    console.debug('handleCommentChangedMessage', `cached ${tid}, its author ${author.id}, and added to it to the tracking set`);
};
