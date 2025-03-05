import { TriggerContext } from "@devvit/public-api";
import { PostChangedMessage } from "../../protocol.js";
import { isEventDuplicated } from "../../utility.js";
import { cachePost, cacheUser, trackThing } from "../redis.js";
import { getBasicUserInfoByUsername, getPostById } from "../../reddit.js";
import { T3ID } from "@devvit/shared-types/tid.js";

export const handlePostChangedMessage = async (message: PostChangedMessage, context: TriggerContext): Promise<void> => {
    const tid = message.tid;

    // need to pull the real comment so that we can navigate it
    // open mod respects the privacy of users, so if a user blocks open mod
    // this call will fail, and the event will be ignored
    const post = await getPostById(tid as T3ID, context);
    if (!post) {
        console.debug('handlePostChangedMessage', `post ${tid} not found`);
        return;
    }

    // if the comment is new, but this is not the first time we've seen it, ignore it
    const isDuplicate = await isEventDuplicated(tid, context);
    if (!post.edited && isDuplicate) {
        console.debug('handlePostChangedMessage', `postsubmit ${post.id} is a duplicate`);
        return;
    }

    const author = await getBasicUserInfoByUsername(post.authorName, context);
    if (!author) {
        console.debug('handlePostChangedMessage', `user ${post.authorId} not found`);
        return;
    }

    await cachePost(post, context);
    await cacheUser(author, context);
    await trackThing(post, context);
    console.debug('handlePostChangedMessage', `cached ${tid}, its author ${author.id}, and added to it to the tracking set`);
};
