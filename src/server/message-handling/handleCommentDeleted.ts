import { TriggerContext } from "@devvit/public-api";
import { ProtocolMessage } from "../../protocol.js";
import { isEventDuplicated } from "../../utility.js";
import { RK_DELETE_EVENT, delCacheOf } from "../redis.js";

export const handleCommentDeletedMessage = async (message: ProtocolMessage, context: TriggerContext): Promise<void> => {
    const tid = message.tid;

    const comment = await context.reddit.getCommentById(tid);
    if (!comment) {
        console.debug(`comment ${tid} not found`);
        return;
    }

    const isDuplicate = await isEventDuplicated(RK_DELETE_EVENT(tid), context);
    if (isDuplicate) {
        console.debug(`commentdelete ${tid} is a duplicate`);
        return;
    }

    await delCacheOf(tid, context);
    console.debug(`forgot comment ${tid}, goodbye ${tid}`);
};
