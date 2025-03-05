import { TriggerContext } from "@devvit/public-api";
import { now, seconds } from "./temporal.js";
import { WP_APP_VERSION } from "./constants.js";
import { satisfies } from "semver";

export const isEventDuplicated = async (event: string, context: TriggerContext): Promise<boolean> => {
    const key = `event:${event}`;
    const marker = await context.redis.get(key);

    if (marker === undefined) {
        await context.redis.set(key, `${now()}`);
        console.debug('isEventDuplicated', `it is the first time i have seen ${event}`);
    }

    await context.redis.expire(key, seconds({ days: 14 }));
    console.debug('isEventDuplicated', `expiry for ${event} has been reset 14 days`);

    return !!marker;
};

/**
 * Check that the instance at the target subreddit has the same version as the currently executing instance
 * @param subredditName the target subreddit
 * @param context the trigger context
 * @returns 
 */
export const hasFeatureParity = async (subredditName: string, context: TriggerContext): Promise<boolean> => {
    const pages = await context.reddit.getWikiPages(subredditName);
    if (!pages.includes(WP_APP_VERSION)) {
        console.debug('hasFeatureParity', `wiki page ${WP_APP_VERSION} not found so i assume we are not compatible`);
        return false;
    }

    const wikiPage = await context.reddit.getWikiPage(subredditName, WP_APP_VERSION);

    // for now, we enforce identical versions
    // in the future (post v2) it may be possible to relax this constraint to "at least my version"
    const result = satisfies(wikiPage.content, context.appVersion);

    console.debug('hasFeatureParity', `instance at r/${subredditName} has version ${wikiPage.content} and my version is ${context.appVersion} so ${result ? 'we are compatible' : 'we are not compatible'}`);
    return result;
};

