import { TriggerContext } from "@devvit/public-api";
import { CommentID, PostID, SubredditID, ThingID, UserID } from "../types.js";

export const isRecordEmpty = (record: Record<string, unknown>): boolean => {
    for (const property in record) {
        console.debug(`the given record is not empty, it has the property ${property}`);
        return false;
    }

    console.debug('the given record is empty');
    return true;
};

export const isCommentID = (thingid: ThingID): thingid is CommentID => thingid.startsWith('t1_');
export const isUserID = (thingid: ThingID): thingid is UserID => thingid.startsWith('t2_');
export const isPostID = (thingid: ThingID): thingid is PostID => thingid.startsWith('t3_');
export const isSubredditID = (thingid: ThingID): thingid is SubredditID => thingid.startsWith('t5_');

export const userIsActive = async (user: string, context: TriggerContext): Promise<boolean> => {
    try {
        // if this call fails, then the user:
        // 1) is deleted
        // 2) is shadowbanned/suspended
        // 3) never existed in the first place
        // 4) has blocked open mod
        const x = await context.reddit.getUserById(user);

        const result = !!x;
        if (!result) {
            console.debug(`user ${user} is deleted, shadowbanned, suspended, never existed, or has blocked open mod`);
        }

        return result;
    } catch {
        console.debug(`user ${user} is deleted, shadowbanned, suspended, never existed, or has blocked open mod`);
        return false;
    }
};
