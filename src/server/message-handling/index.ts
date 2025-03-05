import { TriggerContext } from "@devvit/public-api";
import { ProtocolEvent, ProtocolMessage } from "../../protocol.js";
import { handleCommentChangedMessage } from "./handleCommentChanged.js";
import { handlePostChangedMessage } from "./handlePostChanged.js";
import { handleCommentDeletedMessage } from "./handleCommentDeleted.js";
import { handlePostDeletedMessage } from "./handlePostDeleted.js";
import { handleModActionMessage } from "./handleModAction.js";
import { handleSettingsUpdatedMessage } from "./handleSettingsUpdated.js";

export const handleMessage = async (message: ProtocolMessage, context: TriggerContext): Promise<void> => {
    console.debug('handleMessage', `handling message of type ${message.type}`);
    switch (message.type) {
        case ProtocolEvent.CommentChanged:
            await handleCommentChangedMessage(message, context);
            console.debug('handleMessage', `handled comment changed message`);
            break;
        case ProtocolEvent.CommentDelete:
            await handleCommentDeletedMessage(message, context);
            console.debug('handleMessage', `handled comment deleted message`);
            break;
        case ProtocolEvent.PostChanged:
            await handlePostChangedMessage(message, context);
            console.debug('handleMessage', `handled post changed message`);
            break;
        case ProtocolEvent.PostDelete:
            await handlePostDeletedMessage(message, context);
            console.debug('handleMessage', `handled post deleted message`);
            break;
        case ProtocolEvent.ModAction:
            await handleModActionMessage(message, context);
            console.debug('handleMessage', `handled mod action message`);
            break;
        case ProtocolEvent.SettingsUpdated:
            await handleSettingsUpdatedMessage(message, context);
            console.debug('handleMessage', `handled settings updated message`);
            break;
        default:
            console.error('handleMessage', `i find myself in a strange place, this doesn't seem right - please check the surrounding logs to work out how i got here`);
            break; // console.error('handleMessage', `unknown message type: ${message.type}`);
    };
};
