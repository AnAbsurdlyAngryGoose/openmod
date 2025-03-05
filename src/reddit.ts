import { Comment, Post, SubmitPostOptions, SubredditInfo, TriggerContext, UpdateWikiPageOptions, WikiPage } from "@devvit/public-api";
import { BasicUserData, SpecialAccountName } from "./types.js";
import { SPECIAL_ACCOUNT_IDS, SPECIAL_ACCOUNT_ID_TO_NAME, SPECIAL_ACCOUNT_NAMES, SPECIAL_ACCOUNT_NAME_TO_ID } from "./constants.js";
import { T1ID, T2ID, T3ID, T5ID } from "@devvit/shared-types/tid.js";

// getCommentById
export const getCommentById = async (id: T1ID, context: TriggerContext) : Promise<Comment | undefined> => {
    try {
        return await context.reddit.getCommentById(id);
    } catch (e) {
        console.error('getCommendById', `getCommentById(${id}) failed: ${e}`);
    }
};

// getSubredditInfoById
export const getSubredditInfoById = async (id: T5ID, context: TriggerContext) : Promise<SubredditInfo | undefined> => {
    try {
        return await context.reddit.getSubredditInfoById(id);
    } catch (e) {
        console.error('getSubredditInfoById', `getSubredditById(${id}) failed: ${e}`);
    }
};

// getPostById
export const getPostById = async (id: T3ID, context: TriggerContext) : Promise<Post | undefined> => {
    try {
        return await context.reddit.getPostById(id);
    } catch (e) {
        console.error('getPostById', `getPostById(${id}) failed: ${e}`);
    }
}

// submitPost
export const submitPost = async (options: SubmitPostOptions, context: TriggerContext) : Promise<Post | undefined> => {
    try {
        return await context.reddit.submitPost(options);
    } catch (e) {
        console.error('submitPost', `submitPost(${JSON.stringify(options)}) failed: ${e}`);
    }
};

// getCurrentSubredditName
export const getCurrentSubredditName = async (context: TriggerContext) : Promise<string | undefined> => {
    try {
        return await context.reddit.getCurrentSubredditName();
    } catch (e) {
        console.error('getCurrentSubredditName', `getCurrentSubredditName() failed: ${e}`);
    }
};

// getWikiPage
export const getWikiPage = async (subredditName: string, page: string, context: TriggerContext) : Promise<WikiPage | undefined> => {
    try {
        return await context.reddit.getWikiPage(subredditName, page);
    } catch (e) {
        console.error('getWikiPage', `getWikiPage(${subredditName}, ${page}) failed: ${e}`);
    }
};

// updateWikiPage
export const updateWikiPage = async (options: UpdateWikiPageOptions, context: TriggerContext) : Promise<WikiPage | undefined> => {
    try {
        return await context.reddit.updateWikiPage(options);
    } catch (e) {
        console.error('updateWikiPage', `updateWikiPage(${JSON.stringify(options)}) failed: ${e}`);
    }
};

// getUserByUsername
export const getBasicUserInfoByUsername = async (username: string, context: TriggerContext): Promise<BasicUserData> => {
    if (SPECIAL_ACCOUNT_NAMES.includes(username)) {
        const normalised = username === SpecialAccountName.Redacted ? SpecialAccountName.AntiEvilOperations : username;
        console.debug('getBasicUserInfoByUsername', `found special account ${normalised}`);
        return {
            id: SPECIAL_ACCOUNT_NAME_TO_ID[normalised],
            username: normalised,
            isAdmin: true,
            isApp: false
        };
    }

    const user = await context.reddit.getUserByUsername(username);
    if (!user) {
        console.debug('getBasicUserInfoByUsername', `${username} unavailable`);
        return {
            id: SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Unavailable],
            username: SpecialAccountName.Unavailable,
            isAdmin: false,
            isApp: false
        };
    }

    console.debug('getBasicUserInfoByUsername', `found user ${user.username}`);
    return {
        id: user.id as T2ID,
        username: user.username,
        isAdmin: user.isAdmin,
        isApp: false
    };
};

// getUserById
export const getBasicUserInfoById = async (id: T2ID, context: TriggerContext): Promise<BasicUserData> => {
    if (SPECIAL_ACCOUNT_IDS.includes(id)) {
        const username = SPECIAL_ACCOUNT_ID_TO_NAME[id];
        const normalised = username === SpecialAccountName.Redacted ? SpecialAccountName.AntiEvilOperations : username;
        console.debug('getBasicUserInfoById', `found special account ${normalised}`);
        return {
            id: SPECIAL_ACCOUNT_NAME_TO_ID[normalised],
            username: normalised,
            isAdmin: true,
            isApp: false
        };
    }

    const user = await context.reddit.getUserById(id);
    if (!user) {
        console.debug('getBasicUserInfoById', `${id} unavailable`);
        return {
            id: SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Unavailable],
            username: SpecialAccountName.Unavailable,
            isAdmin: false,
            isApp: false
        };
    }

    console.debug('getBasicUserInfoById', `found user ${user.username}`);
    return {
        id: user.id as T2ID,
        username: user.username,
        isAdmin: user.isAdmin,
        isApp: false
    };
};
