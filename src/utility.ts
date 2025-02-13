import { TriggerContext } from "@devvit/public-api";
import { now, seconds } from "./temporal.js";
import { BasicUserData, SpecialAccountName, UserID } from "./types.js";
import { SPECIAL_ACCOUNT_IDS, SPECIAL_ACCOUNT_ID_TO_NAME, SPECIAL_ACCOUNT_NAMES, SPECIAL_ACCOUNT_NAME_TO_ID } from "./constants.js";

export const isEventDuplicated = async (event: string, context: TriggerContext): Promise<boolean> => {
    const key = `event:${event}`;
    const marker = await context.redis.get(key);

    if (!marker) {
        await context.redis.set(key, `${now()}`);
        await context.redis.expire(key, seconds({ days: 14 }));
        console.debug(`event ${event} is a duplicate, the expiry has been refreshed`);
    }

    return !!marker;
};

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
