import { TriggerContext } from "@devvit/public-api";
import { ProtocolMessage } from "../../protocol.js";
import { isEventDuplicated } from "../../utility.js";
import { cacheComment, cacheUser, trackThing } from "../redis.js";
import { getBasicUserInfoByUsername, getCommentById } from "../../reddit.js";
import { CommentID } from "../../types.js";

export const handleCommentChangedMessage = async (message: ProtocolMessage, context: TriggerContext): Promise<void> => {
    const tid = message.tid;

    // need to pull the real comment so that we can navigate it
    // open mod respects the privacy of users, so if a user blocks open mod
    // this call will fail, and the event will be ignored
    const comment = await getCommentById(tid as CommentID, context);
    if (!comment) {
        console.debug(`comment ${tid} not found`);
        return;
    }

    // if the comment is new, but this is not the first time we've seen it, ignore it
    const isDuplicate = await isEventDuplicated(tid, context);
    if (!comment.edited && isDuplicate) {
        console.debug(`commentsubmit ${comment.id} is a duplicate`);
        return;
    }

    const author = await getBasicUserInfoByUsername(comment.authorName, context);
    if (!author) {
        console.debug(`user ${comment.authorId} not found`);
        return;
    }

    await cacheComment(comment, context);
    await cacheUser(author, context);
    await trackThing(comment, context);
    console.debug(`cached ${tid}, its author ${author.id}, and added to it to the tracking set`);
};
