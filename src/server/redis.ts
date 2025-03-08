import { TriggerContext, Comment, Post, User, SubredditInfo } from "@devvit/public-api";
import { CommentID, PostID, ThingID, UserID, CacheType, CachedComment, CachedPost, CachedUser, SpecialAccountName, BasicUserData, SubredditID, CachedSubreddit } from "../types.js";
import { now, seconds } from "../temporal.js";
import { RK_SIGNS_OF_LIFE, SPECIAL_ACCOUNT_NAME_TO_ID } from "../constants.js";
import { isRecordEmpty } from "./utility.js";
import { getBasicUserInfoById, getCommentById, getPostById, getSubredditInfoById } from "../reddit.js";
import { ModActionMessage } from "../protocol.js";

const RK_CACHED_THING = (thing: ThingID): string => {
    return `cache:${thing}`;
};

const RK_USER = (thing: UserID): string => {
    return `user:${thing}`;
};

const RK_MOD_ACTION = (thing: ThingID): string => {
    return `mod-actions:${thing}`;
};

// the message associated with an extract submission
// stored so we can later recreate it if necessary
const RK_PROTOCOL_MESSAGE = (thing: ThingID): string => {
    return `protocol-msg:${thing}`;
};

export const RK_DELETE_EVENT = (thing: ThingID): string => {
    return `delete:${thing}`;
};

export const cacheComment = async (comment: Comment, context: TriggerContext) : Promise<CachedComment> => {
    const data: CachedComment = {
        type: CacheType.Comment,
        author: comment.authorId ?? SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Deleted],
        body: comment.body,
        permalink: comment.permalink,
    };

    return await internalCacheComment(comment.id, data, context);
};

const internalCacheComment = async (id: CommentID, comment: CachedComment, context: TriggerContext) : Promise<CachedComment> => {
    await context.redis.hSet(RK_CACHED_THING(id), comment);
    await context.redis.expire(RK_CACHED_THING(id), seconds({ days: 28 }));
    console.debug('internalCacheComment', `refreshed cached comment ${id} and set it to expire in 28 days`);
    return comment;
};

export const getCachedComment = async (commentid: CommentID, context: TriggerContext): Promise<CachedComment> => {
    const data = await context.redis.hGetAll(RK_CACHED_THING(commentid));
    if (!isRecordEmpty(data)) {
        await context.redis.expire(RK_CACHED_THING(commentid), seconds({ days: 28 }));
    
        console.debug('getCachedComment', `found cached comment ${commentid} and refreshed its expiry`);
        return data as CachedComment;
    }

    const comment = await getCommentById(commentid, context);
    if (!comment) {
        return await internalCacheComment(commentid, {
            type: CacheType.Comment,
            author: SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Unavailable],
            body: '[ unavailable ]',
            permalink: '[ unavailable ]',
        }, context);
    }

    return await cacheComment(comment, context);
};

export const cacheUser = async (user: User | BasicUserData, context: TriggerContext) : Promise<CachedUser> => {
    const data: CachedUser = {
        type: CacheType.User,
        username: user.username,
        isAdmin: user.isAdmin ? 'admin' : undefined,
        isApp: undefined, // it is not currently possible to determine if a user is an app
    };

    await context.redis.hSet(RK_CACHED_THING(user.id), data);
    await context.redis.expire(RK_CACHED_THING(user.id), seconds({ days: 28 }));
    console.debug('cacheUser', `refreshed cached user ${user.id} and set it to expire in 28 days`);

    // keep a record that this user has been observed by open mod
    // so that we can remove anything related to them later should they delete their account
    // note that we don't do this when we observe content - content is managed separately
    await context.redis.zAdd(RK_SIGNS_OF_LIFE, { member: user.id, score: now() });
    console.debug('cacheUser', `refreshed user ${user.id}'s timeout in signs of life set`);

    return data;
};

export const getCachedUser = async (userid: UserID, context: TriggerContext): Promise<CachedUser> => {
    const data = await context.redis.hGetAll(RK_CACHED_THING(userid));
    if (!isRecordEmpty(data)) {
        await context.redis.expire(RK_CACHED_THING(userid), seconds({ days: 28 }));

        console.debug('getCachedUser', `found cached user ${userid} and refreshed its expiry`);
        return data as CachedUser;
    }

    let user = await getBasicUserInfoById(userid, context);
    return await cacheUser(user, context);
};

export const cachePost = async (post: Post, context: TriggerContext) : Promise<CachedPost> => {
    const data: CachedPost = {
        type: CacheType.Post,
        author: post.authorId ?? SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Deleted],
        title: post.title,
        url: post.url,
        body: post.body,
        permalink: post.permalink,
    };

    return await internalCachePost(post.id, data, context);
};

const internalCachePost = async (id: PostID, post: CachedPost, context: TriggerContext) : Promise<CachedPost> => {
    await context.redis.hSet(RK_CACHED_THING(id), post);
    await context.redis.expire(RK_CACHED_THING(id), seconds({ days: 28 }));
    console.debug('internalCachePost', `refreshed cached post ${id} and set it to expire in 28 days`);
    return post;
};

export const getCachedPost = async (linkid: PostID, context: TriggerContext): Promise<CachedPost> => {
    const data = await context.redis.hGetAll(RK_CACHED_THING(linkid));
    if (!isRecordEmpty(data)) {
        await context.redis.expire(RK_CACHED_THING(linkid), seconds({ days: 28 }));

        console.debug('getCachedPost', `found cached post ${linkid} and refreshed its expiry`);
        return data as CachedPost;
    }

    const post = await getPostById(linkid, context);
    if (!post) {
        return await internalCachePost(linkid, {
            type: CacheType.Post,
            author: SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Unavailable],
            title: '[ unavailable ]',
            url: '[ unavailable ]',
            body: '[ unavailable ]',
            permalink: '[ unavailable ]',
        }, context);
    }

    return await cachePost(post, context);
};

export const delCacheOf = async (thingid: ThingID, context: TriggerContext) => {
    await context.redis.del(RK_CACHED_THING(thingid));
    console.debug('delCacheOf', `deleted cache of ${thingid}`);
};

export const trackThing = async (thing: Comment | Post, context: TriggerContext) => {
    await context.redis.zAdd(RK_USER(thing.authorId!), {
        member: thing.id,
        score: thing.createdAt.getTime()
    });
    console.debug('trackThing', `added ${thing.id} to tracking set ${thing.authorId}`);
};

export const delTrackingSet = async (userid: UserID, context: TriggerContext) => {
    await context.redis.del(RK_USER(userid));
    console.debug('delTrackingSet', `deleted tracking set ${userid}`);
};

export const addModAction = async (thingid: ThingID, linkid: PostID, context: TriggerContext) => {
    await context.redis.zAdd(RK_MOD_ACTION(thingid), { member: linkid, score: now() });
    console.debug('addModAction', `added extract ${linkid} to ${thingid}'s record`);
};

export const addExtract = async (linkid: PostID, message: ModActionMessage, context: TriggerContext) => {
    await context.redis.hSet(RK_PROTOCOL_MESSAGE(linkid), {
        ...message,
        v: `${message.v}`,
        ts: `${message.ts}`,
        ctx: `${message.ctx}`,
    });

    console.debug('addExtract', `added extract ${linkid}`);
};

export const getExtract = async (linkid: PostID, context: TriggerContext): Promise<ModActionMessage | undefined> => {
    const hashed = await context.redis.hGetAll(RK_PROTOCOL_MESSAGE(linkid));
    if (isRecordEmpty(hashed)) {
        console.error('getExtract', `extract ${linkid} not found`);
        return;
    }

    return <ModActionMessage>{
        ...hashed,
        v: 2,
        ts: parseInt(hashed.ts),
        ctx: hashed.ctx === "true"
    };
};

export const cacheSubreddit = async (subreddit: SubredditInfo, context: TriggerContext) => {
    const data: CachedSubreddit = {
        name: subreddit.name ?? '[ unavailable ]'
    };

    return await internalCacheSubreddit(subreddit.id!, data, context);
};

const internalCacheSubreddit = async (id: SubredditID, subreddit: CachedSubreddit, context: TriggerContext) => {
    await context.redis.hSet(RK_CACHED_THING(id), subreddit);
    await context.redis.expire(RK_CACHED_THING(id), seconds({ days: 28 }));
    console.debug('internalCacheSubreddit', `refreshed cached subreddit ${id} and set it to expire in 28 days`);
    return subreddit;
};

export const getCachedSubreddit = async (subredditid: SubredditID, context: TriggerContext): Promise<CachedSubreddit> => {
    const data = await context.redis.hGetAll(RK_CACHED_THING(subredditid));
    if (!isRecordEmpty(data)) {
        await context.redis.expire(RK_CACHED_THING(subredditid), seconds({ days: 28 }));

        console.debug('getCachedSubreddit', `found cached subreddit ${subredditid} and refreshed its expiry`);
        return data as CachedSubreddit;
    }

    const subreddit = await getSubredditInfoById(subredditid, context);
    if (!subreddit) {
        return await internalCacheSubreddit(subredditid, {
            name: '[ unavailable ]'
        }, context);
    }

    return await cacheSubreddit(subreddit, context);
};