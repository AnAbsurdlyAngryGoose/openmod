import { TriggerContext } from "@devvit/public-api";
import { ProtocolMessage } from "../../protocol.js";
import { isEventDuplicated } from "../../utility.js";
import { cachePost, cacheUser, trackThing } from "../redis.js";

export const handlePostChangedMessage = async (message: ProtocolMessage, context: TriggerContext): Promise<void> => {
    const tid = message.tid;

    // need to pull the real comment so that we can navigate it
    // open mod respects the privacy of users, so if a user blocks open mod
    // this call will fail, and the event will be ignored
    const post = await context.reddit.getPostById(tid);
    if (!post) {
        console.debug(`post ${tid} not found`);
        return;
    }

    // if the comment is new, but this is not the first time we've seen it, ignore it
    const isDuplicate = await isEventDuplicated(tid, context);
    if (!post.edited && isDuplicate) {
        console.debug(`postsubmit ${post.id} is a duplicate`);
        return;
    }

    const author = await post.getAuthor();
    if (!author) {
        console.debug(`user ${post.authorId} not found`);
        return;
    }

    // todo what if the user posting is u/reddit?
    await cachePost(post, context);
    await cacheUser(author, context);
    await trackThing(post, context);
    console.debug(`cached ${tid}, its author ${author.id}, and added to it to the tracking set`);
};
