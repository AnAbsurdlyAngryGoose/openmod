import { T2ID } from '@devvit/shared-types/tid.js'

export type Nothing = { };

export enum ModActionType {
    // vInitial
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

    // v1.3
    AddModerator = 'addmoderator',
    InviteModerator = 'invitemoderator',
    AcceptModeratorInvite = 'acceptmoderatorinvite',
    RemoveModerator = 'removemoderator',
    AddContributor = 'addcontributor',
    RemoveContributor = 'removecontributor',
};

export enum CacheType {
    Comment = 'comment',
    Post = 'post',
    User = 'user'
};

type Cached<T extends CacheType> = { type: T };

export type CachedComment = Cached<CacheType.Comment> & {
    author: T2ID,
    body: string,
    permalink: string
};

export type CachedPost = Cached<CacheType.Post> & {
    author: T2ID,
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
    ModCodeOfConduct = 'ModCodeofConduct'
};

export type BasicUserData = {
    id: T2ID,
    username: string,
    isAdmin: boolean,
    isApp: boolean
};

export type CachedSubreddit = {
    name: string
};

export type ModLogEntry = {
    type: ModActionType,
    moderatorName: string,
    details?: string,
    description?: string,
};
