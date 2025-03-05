/**
 * message passing protocol for open mod
 * the protocol is versioned to allow for future changes
 * and is strictly additive, ensuring backwards compatibility
 */

import { ModActionType, Rule, SubredditID, ThingID, UserID } from "./types.js";

/** high level components */

export enum ProtocolEvent {
    CommentChanged = "commentChanged",
    CommentDelete = "commentDelete",
    PostChanged = "postChanged",
    PostDelete = "postDelete",
    ModAction = "modAction",
};

/**
 * The basic message type
 * Encapsulates the type of the message, the version of the protocol, and the target thing id
 */
type Message<T extends string, V extends number> = {
    /**
     * The type of this message, e.g. "commentChanged"
     */
    type: T;

    /**
     * The version of the protocol, e.g. "2"
     */
    v: V;

    /**
     * The target thing id of the object this message is about
     * This is a unique identifier for a comment, post, or user
     * e.g. "t1_abc123" for a comment
     * The target thing id is usually a user id
     */
    tid: ThingID;

    /**
     * The subreddit this message was received from
     */
    sid: SubredditID;

    /**
     * The timestamp of the message
     */
    ts: number;
};

/** open-mod v2 protocol */

type MessageV2<T extends string> = Message<T, 2>;

/**
 * A comment was created or updated
 * The server will pull the comment given by tid and use the isEdited field to determine which scenario was notified
 */
type CommentChangedMessage = MessageV2<ProtocolEvent.CommentChanged>;

/**
 * A comment was deleted
 * The server will enforce Content Deletion Policy for the comment given by tid
 */
type CommentDeleteMessage = MessageV2<ProtocolEvent.CommentDelete>;

/**
 * A post was created or updated
 * The server will pull the post given by tid and use the isEdited field to determine which scenario was notified
 */
type PostChangedMessage = MessageV2<ProtocolEvent.PostChanged>;

/**
 * A post was deleted
 * The server will enforce Content Deletion Policy for the post given by tid
 */
type PostDeleteMessage = MessageV2<ProtocolEvent.PostDelete>;

/**
 * A mod action messsage
 * These expand the base message with information about the moderator and action taken
 * Whilst ordinarily it's expected that the target thing id is a user id
 * For a mod action, it is the moderated thing id
 * e.g., if the action was removecomment, the target thing id would be the comment id of the removed content
 */
export type BaseModActionMessage<T extends ModActionType> = MessageV2<ProtocolEvent.ModAction> & {
    /**
     * The subtype of the message
     * This represents the action taken by the moderator, e.g. "banuser"
     */
    sub: T;

    /**
     * The user id moderator who took the action
     */
    mod: UserID;

    /**
     * Whether context should be included
     */
    ctx: boolean;
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

// v1.4

type CreateRuleMessage = MessageV2<ModActionType.CreateRule> & {
    prio: number;
    rule: Rule;
};

type EditRuleMessage = MessageV2<ModActionType.EditRule> & {
    prio: number;
    rule: Rule;
};

type DeleteRuleMessage = MessageV2<ModActionType.DeleteRule> & {
    prio: number;
};

type ReorderRulesMessage = MessageV2<ModActionType.ReorderRules> & {
    /** the new order of the rules */
    prio: number[];
};

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
                | CreateRuleMessage
                | EditRuleMessage
                | DeleteRuleMessage
                | ReorderRulesMessage;

/** exports */

export type ProtocolMessage = CommentChangedMessage
                | CommentDeleteMessage
                | PostChangedMessage
                | PostDeleteMessage
                | ModActionMessage;
