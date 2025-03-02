import { Comment, Post, SubmitPostOptions, SubredditInfo, TriggerContext, UpdateWikiPageOptions, WikiPage } from "@devvit/public-api";
import { BasicUserData, CommentID, PostID, SpecialAccountName, SubredditID, UserID } from "./types.js";
import { SPECIAL_ACCOUNT_IDS, SPECIAL_ACCOUNT_ID_TO_NAME, SPECIAL_ACCOUNT_NAMES, SPECIAL_ACCOUNT_NAME_TO_ID } from "./constants.js";

// getCommentById
export const getCommentById = async (id: CommentID, context: TriggerContext) : Promise<Comment | undefined> => {
    try {
        return await context.reddit.getCommentById(id);
    } catch (e) {
        console.error(`getCommentById(${id}) failed: ${e}`);
    }
};

// getSubredditInfoById
export const getSubredditInfoById = async (id: SubredditID, context: TriggerContext) : Promise<SubredditInfo | undefined> => {
    try {
        return await context.reddit.getSubredditInfoById(id);
    } catch (e) {
        console.error(`getSubredditById(${id}) failed: ${e}`);
    }
};

// getPostById
export const getPostById = async (id: PostID, context: TriggerContext) : Promise<Post | undefined> => {
    try {
        return await context.reddit.getPostById(id);
    } catch (e) {
        console.error(`getPostById(${id}) failed: ${e}`);
    }
}

// submitPost
export const submitPost = async (options: SubmitPostOptions, context: TriggerContext) : Promise<Post | undefined> => {
    try {
        return await context.reddit.submitPost(options);
    } catch (e) {
        console.error(`submitPost(${JSON.stringify(options)}) failed: ${e}`);
    }
};

// getCurrentSubredditName
export const getCurrentSubredditName = async (context: TriggerContext) : Promise<string | undefined> => {
    try {
        return await context.reddit.getCurrentSubredditName();
    } catch (e) {
        console.error(`getCurrentSubredditName() failed: ${e}`);
    }
};

// getWikiPage
export const getWikiPage = async (subredditName: string, page: string, context: TriggerContext) : Promise<WikiPage | undefined> => {
    try {
        return await context.reddit.getWikiPage(subredditName, page);
    } catch (e) {
        console.error(`getWikiPage(${subredditName}, ${page}) failed: ${e}`);
    }
};

// updateWikiPage
export const updateWikiPage = async (options: UpdateWikiPageOptions, context: TriggerContext) : Promise<WikiPage | undefined> => {
    try {
        return await context.reddit.updateWikiPage(options);
    } catch (e) {
        console.error(`updateWikiPage(${JSON.stringify(options)}) failed: ${e}`);
    }
};

// getUserByUsername
export const getBasicUserInfoByUsername = async (username: string, context: TriggerContext): Promise<BasicUserData> => {
    if (SPECIAL_ACCOUNT_NAMES.includes(username)) {
        const normalised = username === SpecialAccountName.Redacted ? SpecialAccountName.AntiEvilOperations : username;
        console.debug(`found special account ${normalised}`);
        return {
            id: SPECIAL_ACCOUNT_NAME_TO_ID[normalised],
            username: normalised,
            isAdmin: true,
            isApp: false
        };
    }

    const user = await context.reddit.getUserByUsername(username);
    if (!user) {
        console.debug(`${username} unavailable`);
        return {
            id: SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Unavailable],
            username: SpecialAccountName.Unavailable,
            isAdmin: false,
            isApp: false
        };
    }

    console.debug(`found user ${user.username}`);
    return {
        id: user.id as UserID,
        username: user.username,
        isAdmin: user.isAdmin,
        isApp: false
    };
};

// getUserById
export const getBasicUserInfoById = async (id: UserID, context: TriggerContext): Promise<BasicUserData> => {
    if (SPECIAL_ACCOUNT_IDS.includes(id)) {
        const username = SPECIAL_ACCOUNT_ID_TO_NAME[id];
        const normalised = username === SpecialAccountName.Redacted ? SpecialAccountName.AntiEvilOperations : username;
        console.debug(`found special account ${normalised}`);
        return {
            id: SPECIAL_ACCOUNT_NAME_TO_ID[normalised],
            username: normalised,
            isAdmin: true,
            isApp: false
        };
    }

    const user = await context.reddit.getUserById(id);
    if (!user) {
        console.debug(`${id} unavailable`);
        return {
            id: SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Unavailable],
            username: SpecialAccountName.Unavailable,
            isAdmin: false,
            isApp: false
        };
    }

    console.debug(`found user ${user.username}`);
    return {
        id: user.id as UserID,
        username: user.username,
        isAdmin: user.isAdmin,
        isApp: false
    };
};
