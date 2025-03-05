import { TriggerContext } from "@devvit/public-api";
import { PostDeleteMessage } from "../../protocol.js";
import { isEventDuplicated } from "../../utility.js";
import { RK_DELETE_EVENT, delCacheOf } from "../redis.js";
import { getPostById } from "../../reddit.js";
import { T3ID } from "@devvit/shared-types/tid.js";

export const handlePostDeletedMessage = async (message: PostDeleteMessage, context: TriggerContext): Promise<void> => {
    const tid = message.tid;

    const post = await getPostById(tid as T3ID, context);
    if (!post) {
        console.debug('handlePostDeletedMessage', `post ${tid} not found`);
        return;
    }

    const isDuplicate = await isEventDuplicated(RK_DELETE_EVENT(tid), context);
    if (isDuplicate) {
        console.debug('handlePostDeletedMessage', `postdelete ${tid} is a duplicate`);
        return;
    }

    await delCacheOf(tid, context);
    console.debug('handlePostDeletedMessage', `forgot post ${tid}, goodbye ${tid}`);
};
