/**
 * message passing protocol for open mod
 * the protocol is versioned to allow for future changes
 * and is strictly additive, ensuring backwards compatibility
 */

import { ModActionType, SubredditID, ThingID, UserID } from "./types.js";

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
export type ModActionMessage = MessageV2<ProtocolEvent.ModAction> & {
    /**
     * The subtype of the message
     * This represents the action taken by the moderator, e.g. "banuser"
     */
    sub: ModActionType;

    /**
     * The user id moderator who took the action
     */
    mod: UserID;

    /**
     * Whether context should be included
     */
    ctx: boolean;
};

/** exports */

export type ProtocolMessage = CommentChangedMessage | CommentDeleteMessage | PostChangedMessage | PostDeleteMessage | ModActionMessage;
