import { ScheduledJobEvent, TriggerContext } from "@devvit/public-api";
import { ModAction } from "@devvit/protos";
import { Nothing } from "../types.js";
import { future, futureDate, now } from "../temporal.js";
import { BS_EVENTS, BS_SIGNS_OF_LIFE, RK_EVENTS, RK_QUEUE_LAST_REVISION, RK_SIGNS_OF_LIFE, SJ_SIGNS_OF_LIFE } from "../constants.js";
import { WP_OPEN_MOD_EVENTS } from "../constants.js";
import { handleMessage } from "./message-handling/index.js";
import { ProtocolMessage } from "../protocol.js";
import { userIsActive } from "./utility.js";
import { delCacheOf, delTrackingSet } from "./redis.js";
import { getWikiPage } from "../reddit.js";
import { T2ID } from "@devvit/shared-types/tid.js";
import { gunzipSync, strFromU8, strToU8 } from "fflate";

export const onWikiRevision = async (event: ModAction, context: TriggerContext) => {
    if (!event.subreddit || !event.moderator || !event.action) {
        console.error('onWikiRevision', 'unexpectedly encountered a malformed mod action event');
        return;
    }

    if (event.action !== 'wikirevise') {
        console.debug('onWikiRevision', 'ignoring non-wikirevise mod action');
        return;
    }

    const pages = await context.reddit.getWikiPages(event.subreddit.name);
    if (!pages.length || !pages.includes(WP_OPEN_MOD_EVENTS)) {
        console.debug('onWikiRevision', 'ignoring wiki revision event as open mod events page does not exist (i am probably the client)');
        return;
    }

    // get the page, if it doesn't exist we're in the wrong place
    const wikiPage = await getWikiPage(event.subreddit.name, WP_OPEN_MOD_EVENTS, context);
    if (!wikiPage) {
        console.error('onWikiRevision', `wiki page not found in ${event.subreddit.name}`);
        return;
    }

    // we want to guard against someone manually editing the wiki page
    if (!wikiPage.revisionAuthor || wikiPage.revisionAuthor.username !== context.appName) {
        console.warn('onWikiRevision', 'ignoring wiki revision not made by the app');
        return;
    }

    // if the last revision of the queue isn't set, then the page is assumed to be brand new
    // if it is set, then we want to bail if the revision is the same as the last one
    // if it's not set, or it's different, update the last revision value and continue
    const lastRevision = await context.redis.get(RK_QUEUE_LAST_REVISION);
    if (lastRevision && lastRevision === wikiPage.revisionId) {
        console.debug('onWikiRevision', 'wiki page revision is not new');
        return;
    }
    await context.redis.set(RK_QUEUE_LAST_REVISION, wikiPage.revisionId);

    // pull the content from the wiki page, and decompress it if necessary
    let content = wikiPage.content;
    if (!content.startsWith('{')) {
        const inBytes = strToU8(wikiPage.content, true);
        const outBytes = gunzipSync(inBytes);
        content = strFromU8(outBytes);
    }

    // score is ts, and the member is the message.
    // we have to decode to get the time stamp, but we need it encoded to store it
    // there must be a better way to do this
    const members = content.split('\n').map(member => {
        const json = JSON.parse(member) as ProtocolMessage;
        return { member, score: json.ts };
    });
    await context.redis.zAdd(RK_EVENTS, ...members);
    console.debug('onWikiRevision', `added ${members.length} events to the queue`);
};

export const onProcessMessageQueue = async (event: ScheduledJobEvent<Nothing>, context: TriggerContext) => {
    // zRange gets members in ascending order
    const members = await context.redis.zRange(RK_EVENTS, 0, now(), { by: 'score' });
    if (members.length === 0) {
        console.debug('onProcessMessageQueue', 'there are no events to process');
        return;
    }

    const batch = members.slice(0, BS_EVENTS).map(x => x.member);
    await context.redis.zRem(RK_EVENTS, batch);
    console.debug('onProcessMessageQueue', `processing ${batch.length} event(s)`);

    for (const member of batch) {
        console.debug('onProcessMessageQueue', `processing event ${member}`);

        const message = JSON.parse(member) as ProtocolMessage;
        await handleMessage(message, context);
        console.debug('onProcessMessageQueue', `finished processing event`);
    }

    if (members.length > BS_EVENTS) {
        const cardinality = await context.redis.zCard(RK_EVENTS);
        console.debug('onProcessMessageQueue', `there are still ${cardinality} events in the queue, i'll continue processing in one minute`);
    } else {
        console.debug('onProcessMessageQueue', 'the queue has been depleted');
    }
};

export const onCheckSignsOfLife = async (event: ScheduledJobEvent<Nothing>, context: TriggerContext) => {
    const members = await context.redis.zRange(RK_SIGNS_OF_LIFE, 0, now(), { by: 'score' });
    if (members.length === 0) {
        console.debug('onCheckSignsOfLife', `there are no users to check, or the key wasn't found - refer to surrounding logs to determine if this is the correct state`);
        return;
    }

    console.debug('onCheckSignsOfLife', `there are ${members.length} users to check`);

    const users = members.slice(0, BS_SIGNS_OF_LIFE).map(x => x.member);
    const states = await Promise.all(users.map(async x => ({ user: x, active: await userIsActive(x, context) })));

    const toCheckAgainLater = states.filter(x => x.active);
    if (toCheckAgainLater.length > 0) {
        const score = future({ days: 1 }).epochMilliseconds;
        await context.redis.zAdd(RK_SIGNS_OF_LIFE, ...toCheckAgainLater.map(x => ({ member: x.user, score })));
        console.debug('onCheckSignsOfLife', `added ${toCheckAgainLater.length} users back to the queue`);
    }

    const toRemoveNow = states.filter(x => !x.active);
    if (toRemoveNow.length > 0) {
        await context.redis.zRem(RK_SIGNS_OF_LIFE, toRemoveNow.map(x => x.user));
        console.debug('onCheckSignsOfLife', `removed ${toRemoveNow.length} users from the queue`);

        for (const { user } of toRemoveNow) {
            const id = user as T2ID;
            await delCacheOf(id, context);
            await delTrackingSet(id, context);
            console.debug('onCheckSignsOfLife', `forgot user ${id}, goodbye ${id}`);
        }
    }

    if (members.length > BS_SIGNS_OF_LIFE) {
        await context.scheduler.runJob({
            name: SJ_SIGNS_OF_LIFE,
            runAt: futureDate({ seconds: 5 })
        });
        console.debug('onCheckSignsOfLife', 'the queue is not yet depleted, scheduled an additional signs of life check for five seconds from now');
    }
};
