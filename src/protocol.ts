/**
 * message passing protocol for open mod
 * the protocol is versioned to allow for future changes
 * and is strictly additive, ensuring backwards compatibility
 */

import { T2ID, T5ID, TID } from "@devvit/shared-types/tid.js";
import { ModActionType, ModLogEntry } from "./types.js";
import { SettingsValues } from "@devvit/public-api";

/** high level components */

export enum ProtocolEvent {
    CommentChanged = "commentChanged",
    CommentDelete = "commentDelete",
    PostChanged = "postChanged",
    PostDelete = "postDelete",
    ModAction = "modAction",
    SettingsUpdated = "settingsUpdated",
};

/**
 * The basic message type
 * @property type - the type of the message
 * @property v - the version of the protocol
 * @property ts - the timestamp of the message
 * @property sid - the subreddit this message was received from
 */
type Message<T extends string, V extends number> = {
    type: T;
    v: V;
    ts: number;
    sid: T5ID;
};

/**
 * open-mod v2 protocol
 * covers mod actions and content udpates
 */

/**
 * Base message for protocol v2
 * @property tid - the target thing id of the object this message is about
 */
type MessageV2<T extends string> = Message<T, 2> & {
    tid: TID;
};

/**
 * A comment was created or updated
 * The server will pull the comment given by tid and use the isEdited field to determine which scenario was notified
 */
export type CommentChangedMessage = MessageV2<ProtocolEvent.CommentChanged>;

/**
 * A comment was deleted
 * The server will enforce Content Deletion Policy for the comment given by tid
 */
export type CommentDeleteMessage = MessageV2<ProtocolEvent.CommentDelete>;

/**
 * A post was created or updated
 * The server will pull the post given by tid and use the isEdited field to determine which scenario was notified
 */
export type PostChangedMessage = MessageV2<ProtocolEvent.PostChanged>;

/**
 * A post was deleted
 * The server will enforce Content Deletion Policy for the post given by tid
 */
export type PostDeleteMessage = MessageV2<ProtocolEvent.PostDelete>;

/**
 * A mod action messsage
 * These expand the base message with information about the moderator and action taken
 * Whilst ordinarily it's expected that the target thing id is a user id
 * For a mod action, it is the moderated thing id
 * e.g., if the action was removecomment, the target thing id would be the comment id of the removed content
 * 
 * @property sub - the subtype of the message, e.g. removelink
 * @property mod - the user id of the moderator who took the action
 * @property ctx - whether context should be included
 */
type BaseModActionMessage<T extends ModActionType> = MessageV2<ProtocolEvent.ModAction> & {
    sub: T;
    mod: T2ID;
    ctx: boolean;
    log?: ModLogEntry[];
};

/** modactions */

// app v1.2

type RemoveLinkMessage = BaseModActionMessage<ModActionType.RemoveLink>;
type SpamLinkMessage = BaseModActionMessage<ModActionType.SpamLink>;
type ApproveLinkMessage = BaseModActionMessage<ModActionType.ApproveLink>;
type RemoveCommentMessage = BaseModActionMessage<ModActionType.RemoveComment>;
type SpamCommentMessage = BaseModActionMessage<ModActionType.SpamComment>;
type ApproveCommentMessage = BaseModActionMessage<ModActionType.ApproveComment>;
type BanUserMessage = BaseModActionMessage<ModActionType.BanUser>;
type UnbanUserMessage = BaseModActionMessage<ModActionType.UnbanUser>;
type MuteUserMessage = BaseModActionMessage<ModActionType.MuteUser>;
type UnmuteUserMessage = BaseModActionMessage<ModActionType.UnmuteUser>;
type LockSubmissionMessage = BaseModActionMessage<ModActionType.LockSubmission>;
type UnlockSubmissionMessage = BaseModActionMessage<ModActionType.UnlockSubmission>;

// v1.3

type AddModeratorMessage = BaseModActionMessage<ModActionType.AddModerator>;
type InviteModeratorMessage = BaseModActionMessage<ModActionType.InviteModerator>;
type AcceptModeratorInviteMessage = BaseModActionMessage<ModActionType.AcceptModeratorInvite>;
type RemoveModeratorMessage = BaseModActionMessage<ModActionType.RemoveModerator>;
type AddContributorMessage = BaseModActionMessage<ModActionType.AddContributor>;
type RemoveContributorMessage = BaseModActionMessage<ModActionType.RemoveContributor>;

export type ModActionMessage = RemoveLinkMessage
                | SpamLinkMessage
                | ApproveLinkMessage
                | RemoveCommentMessage
                | SpamCommentMessage
                | ApproveCommentMessage
                | BanUserMessage
                | UnbanUserMessage
                | MuteUserMessage
                | UnmuteUserMessage
                | LockSubmissionMessage
                | UnlockSubmissionMessage
                | AddModeratorMessage
                | InviteModeratorMessage
                | AcceptModeratorInviteMessage
                | RemoveModeratorMessage
                | AddContributorMessage
                | RemoveContributorMessage
                ;

/**
 * open-mod v3 protocol
 */

/**
 * Base type for protocol v3
 */
type MessageV3<T extends string> = Message<T, 3>;

/**
 * A settings update message
 * @property settings - the new settings values
 */
export type SettingsUpdatedMessage = MessageV3<ProtocolEvent.SettingsUpdated> & {
    settings: SettingsValues;
};

/** protocol type */

export type ProtocolMessage = CommentChangedMessage
                | CommentDeleteMessage
                | PostChangedMessage
                | PostDeleteMessage
                | ModActionMessage
                | SettingsUpdatedMessage
                ;
