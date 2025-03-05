import { TriggerContext } from "@devvit/public-api";
import { CommentDeleteMessage } from "../../protocol.js";
import { isEventDuplicated } from "../../utility.js";
import { RK_DELETE_EVENT, delCacheOf } from "../redis.js";
import { getCommentById } from "../../reddit.js";
import { T1ID } from "@devvit/shared-types/tid.js";

export const handleCommentDeletedMessage = async (message: CommentDeleteMessage, context: TriggerContext): Promise<void> => {
    const tid = message.tid;

    const comment = await getCommentById(tid as T1ID, context);
    if (!comment) {
        console.debug('handleCommentDeletedMessage', `comment ${tid} not found`);
        return;
    }

    const isDuplicate = await isEventDuplicated(RK_DELETE_EVENT(tid), context);
    if (isDuplicate) {
        console.debug('handleCommentDeletedMessage', `commentdelete ${tid} is a duplicate`);
        return;
    }

    await delCacheOf(tid, context);
    console.debug('handleCommentDeletedMessage', `forgot comment ${tid}, goodbye ${tid}`);
};
