import { TriggerContext } from "@devvit/public-api";
import { ProtocolEvent, ProtocolMessage } from "../../protocol.js";
import { handleCommentChangedMessage } from "./handleCommentChanged.js";
import { handlePostChangedMessage } from "./handlePostChanged.js";
import { handleCommentDeletedMessage } from "./handleCommentDeleted.js";
import { handlePostDeletedMessage } from "./handlePostDeleted.js";
import { handleModActionMessage } from "./handleModAction.js";

export const handleMessage = async (message: ProtocolMessage, context: TriggerContext): Promise<void> => {
    console.debug(`handling message of type ${message.type}`);
    switch (message.type) {
        case ProtocolEvent.CommentChanged:
            await handleCommentChangedMessage(message, context);
            console.debug(`handled comment changed message`);
            break;
        case ProtocolEvent.CommentDelete:
            await handleCommentDeletedMessage(message, context);
            console.debug(`handled comment deleted message`);
            break;
        case ProtocolEvent.PostChanged:
            await handlePostChangedMessage(message, context);
            console.debug(`handled post changed message`);
            break;
        case ProtocolEvent.PostDelete:
            await handlePostDeletedMessage(message, context);
            console.debug(`handled post deleted message`);
            break;
        case ProtocolEvent.ModAction:
            await handleModActionMessage(message, context);
            console.debug(`handled mod action message`);
            break;
        default:
            console.error(`i find myself in a strange place, this doesn't seem right - please check the surrounding logs to work out how i got here`);
            break; // console.error(`unknown message type: ${message.type}`);
    };
};
