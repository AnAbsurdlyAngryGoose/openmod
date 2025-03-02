import { TriggerContext } from "@devvit/public-api";
import { ProtocolMessage } from "../../protocol.js";
import { isEventDuplicated } from "../../utility.js";
import { RK_DELETE_EVENT, delCacheOf } from "../redis.js";
import { getPostById } from "../../reddit.js";
import { PostID } from "../../types.js";

export const handlePostDeletedMessage = async (message: ProtocolMessage, context: TriggerContext): Promise<void> => {
    const tid = message.tid;

    const post = await getPostById(tid as PostID, context);
    if (!post) {
        console.debug(`post ${tid} not found`);
        return;
    }

    const isDuplicate = await isEventDuplicated(RK_DELETE_EVENT(tid), context);
    if (isDuplicate) {
        console.debug(`postdelete ${tid} is a duplicate`);
        return;
    }

    await delCacheOf(tid, context);
    console.debug(`forgot post ${tid}, goodbye ${tid}`);
};
