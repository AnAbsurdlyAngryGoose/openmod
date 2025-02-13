import { TriggerContext, Comment, Post, User } from "@devvit/public-api";
import { CommentID, PostID, ThingID, UserID, CacheType, CachedComment, CachedPost, CachedUser, SpecialAccountName, BasicUserData } from "../types.js";
import { now, seconds } from "../temporal.js";
import { RK_SIGNS_OF_LIFE, SPECIAL_ACCOUNT_NAME_TO_ID } from "../constants.js";
import { isRecordEmpty } from "./utility.js";
import { getBasicUserInfoById } from "../utility.js";

const RK_CACHED_THING = (thing: ThingID): string => {
    return `cache:${thing}`;
};

const RK_USER = (thing: UserID): string => {
    return `user:${thing}`;
};

const RK_MOD_ACTION = (thing: ThingID): string => {
    return `mod-actions:${thing}`;
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

    await context.redis.hSet(RK_CACHED_THING(comment.id), data);
    await context.redis.expire(RK_CACHED_THING(comment.id), seconds({ days: 28 }));

    console.debug(`refreshed cached comment ${comment.id} and set it to expire in 28 days`);
    return data;
};

export const getCachedComment = async (commentid: CommentID, context: TriggerContext): Promise<CachedComment> => {
    const data = await context.redis.hGetAll(RK_CACHED_THING(commentid));
    if (!isRecordEmpty(data)) {
        await context.redis.expire(RK_CACHED_THING(commentid), seconds({ days: 28 }));
    
        console.debug(`found cached comment ${commentid} and refreshed its expiry`);
        return data as CachedComment;
    }

    const comment = await context.reddit.getCommentById(commentid);
    if (!comment) {
        throw new Error(`unable to find comment ${commentid} while refreshing the cache`);
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
    console.debug(`refreshed cached user ${user.id} and set it to expire in 28 days`);

    // keep a record that this user has been observed by open mod
    // so that we can remove anything related to them later should they delete their account
    // note that we don't do this when we observe content - content is managed separately
    await context.redis.zAdd(RK_SIGNS_OF_LIFE, { member: user.id, score: now() });
    console.debug(`refreshed user ${user.id}'s timeout in signs of life set`);

    return data;
};

export const getCachedUser = async (userid: UserID, context: TriggerContext): Promise<CachedUser> => {
    const data = await context.redis.hGetAll(RK_CACHED_THING(userid));
    if (!isRecordEmpty(data)) {
        await context.redis.expire(RK_CACHED_THING(userid), seconds({ days: 28 }));

        console.debug(`found cached user ${userid} and refreshed its expiry`);
        return data as CachedUser;
    }

    // need to handle the case where this fails - e.g. user is deleted/suspended
    let user = await getBasicUserInfoById(userid, context);
    if (!user) {
        throw new Error(`unable to find user ${userid} while refreshing the cache`);
    }

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

    await context.redis.hSet(RK_CACHED_THING(post.id), data);
    await context.redis.expire(RK_CACHED_THING(post.id), seconds({ days: 28 }));

    console.debug(`refreshed cached post ${post.id} and set it to expire in 28 days`);
    return data;
};

export const getCachedPost = async (linkid: PostID, context: TriggerContext): Promise<CachedPost> => {
    const data = await context.redis.hGetAll(RK_CACHED_THING(linkid));
    if (!isRecordEmpty(data)) {
        await context.redis.expire(RK_CACHED_THING(linkid), seconds({ days: 28 }));

        console.debug(`found cached post ${linkid} and refreshed its expiry`);
        return data as CachedPost;
    }

    const post = await context.reddit.getPostById(linkid);
    if (!post) {
        throw new Error(`unable to find post ${linkid} while refreshing the cache`);
    }

    return await cachePost(post, context);
};

export const delCacheOf = async (thingid: ThingID, context: TriggerContext) => {
    await context.redis.del(RK_CACHED_THING(thingid));
    console.debug(`deleted cache of ${thingid}`);
};

export const trackThing = async (thing: Comment | Post, context: TriggerContext) => {
    await context.redis.zAdd(RK_USER(thing.authorId!), {
        member: thing.id,
        score: thing.createdAt.getTime()
    });
    console.debug(`added ${thing.id} to tracking set ${thing.authorId}`);
};

export const delTrackingSet = async (userid: UserID, context: TriggerContext) => {
    await context.redis.del(RK_USER(userid));
    console.debug(`deleted tracking set ${userid}`);
};

export const addModAction = async(thingid: ThingID, linkid: PostID, context: TriggerContext) => {
    await context.redis.zAdd(RK_MOD_ACTION(thingid), { member: linkid, score: now() });
    console.debug(`added extract ${linkid} to ${thingid}'s record`);
};
