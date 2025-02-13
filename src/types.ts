export type CommentID = `t1_${string}`;
export type UserID = `t2_${string}`;
export type PostID = `t3_${string}`;
export type SubredditID = `t5_${string}`;
export type ThingID = CommentID | UserID | PostID | SubredditID;

export type Nothing = { };

export enum ModActionType {
    RemoveLink = 'removelink',
    SpamLink = 'spamlink',
    ApproveLink = 'approvelink',
    RemoveComment = 'removecomment',
    SpamComment = 'spamcomment',
    ApproveComment = 'approvecomment',
    BanUser = 'banuser',
    UnbanUser = 'unbanuser',
    MuteUser = 'muteuser',
    UnmuteUser = 'unmuteuser',
    LockSubmission = 'lock',
    UnlockSubmission = 'unlock',
};

export enum CacheType {
    Comment = 'comment',
    Post = 'post',
    User = 'user'
};

type Cached<T extends CacheType> = { type: T };

export type CachedComment = Cached<CacheType.Comment> & {
    author: UserID,
    body: string,
    permalink: string
};

export type CachedPost = Cached<CacheType.Post> & {
    author: UserID,
    title: string,
    body?: string,
    url: string,
    permalink: string
};

export type CachedUser = Cached<CacheType.User> & {
    username: string,
    isAdmin?: string,
    isApp?: string
};

export enum SpecialAccountName {
    Reddit = 'reddit',
    RedditLegal = 'Reddit Legal',
    AntiEvilOperations = 'Anti-Evil Operations',
    Redacted = '[ redacted ]',        // anti evil operations
    Deleted = '[ deleted ]',          // deleted/suspended
    Unavailable = '[ unavailable ]',  // user not found
};

export type BasicUserData = {
    id: UserID,
    username: string,
    isAdmin: boolean,
    isApp: boolean
};
