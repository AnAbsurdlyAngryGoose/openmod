import { ScheduledJobEvent, TriggerContext } from "@devvit/public-api";
import { ModAction } from "@devvit/protos";
import { Nothing, UserID } from "../types.js";
import { future, futureDate, now } from "../temporal.js";
import { BS_EVENTS, BS_SIGNS_OF_LIFE, RK_EVENTS, RK_PROCESSING, RK_QUEUE_LAST_REVISION, RK_SIGNS_OF_LIFE, SJ_PROCESS_QUEUE, SJ_SIGNS_OF_LIFE } from "../constants.js";
import { WP_OPEN_MOD_EVENTS } from "../constants.js";
import { handleMessage } from "./message-handling/index.js";
import { ProtocolMessage } from "../protocol.js";
import { userIsActive } from "./utility.js";
import { delCacheOf, delTrackingSet } from "./redis.js";
import { getWikiPage } from "../reddit.js";

export const onWikiRevision = async (event: ModAction, context: TriggerContext) => {
    if (!event.subreddit || !event.moderator || !event.action) {
        console.error('unexpectedly encountered a malformed mod action event');
        return;
    }

    if (event.action !== 'wikirevise') {
        console.debug('ignoring non-wikirevise mod action');
        return;
    }

    // get the page, if it doesn't exist we're in the wrong place
    const wikiPage = await getWikiPage(event.subreddit.name, WP_OPEN_MOD_EVENTS, context);
    if (!wikiPage) {
        console.error(`wiki page not found in ${event.subreddit.name}`);
        return;
    }

    // we want to guard against someone manually editing the wiki page
    if (!wikiPage.revisionAuthor || wikiPage.revisionAuthor.username !== context.appName) {
        console.warn('ignoring wiki revision not made by the app');
        return;
    }

    // if the last revision of the queue isn't set, then the page is assumed to be brand new
    // if it is set, then we want to bail if the revision is the same as the last one
    // if it's not set, or it's different, update the last revision value and continue
    const lastRevision = await context.redis.get(RK_QUEUE_LAST_REVISION);
    if (lastRevision && lastRevision === wikiPage.revisionId) {
        console.debug('wiki page revision is not new');
        return;
    }
    await context.redis.set(RK_QUEUE_LAST_REVISION, wikiPage.revisionId);

    // score is ts, and the member is the message.
    // we have to decode to get the time stamp, but we need it encoded to store it
    // there must be a better way to do this
    const members = wikiPage.content.split('\n').map(member => {
        const json = JSON.parse(member) as ProtocolMessage;
        return { member, score: json.ts };
    });
    await context.redis.zAdd(RK_EVENTS, ...members);
    console.debug(`added ${members.length} events to the queue`);

    // check for the processor sentinel and bail if it's already running
    const processing = await context.redis.get(RK_PROCESSING);
    if (processing) {
        console.warn('queue is already being processed');
        return;
    }
    await context.redis.set(RK_PROCESSING, 'true');

    // kick-off the scheduled task that will do the actual processing
    await context.scheduler.runJob({
        name: SJ_PROCESS_QUEUE,
        runAt: futureDate({ seconds: 1 })
    });
    console.debug('scheduled processing of the queue for one second from now');
};

export const onProcessMessageQueue = async (event: ScheduledJobEvent<Nothing>, context: TriggerContext) => {
    await context.redis.set(RK_PROCESSING, 'true');

    // zRange gets members in ascending order
    const members = await context.redis.zRange(RK_EVENTS, 0, now(), { by: 'score' });
    if (members.length === 0) {
        console.debug('the queue is empty and kitty is pleased');

        // remove the processing sentinel so that future wiki revisions trigger this job
        await context.redis.del(RK_PROCESSING);
        return;
    }

    const batch = members.slice(0, BS_EVENTS).map(x => x.member);
    await context.redis.zRem(RK_EVENTS, batch);
    console.debug(`processing ${batch.length} event(s)`);

    for (const member of batch) {
        console.debug(`processing event ${member}`);

        const message = JSON.parse(member) as ProtocolMessage;
        await handleMessage(message, context);
        console.debug(`finished processing event`);
    }

    // run this loop again in one second
    // we'll bail at the top once there's nothing left to do
    await context.scheduler.runJob({
        name: SJ_PROCESS_QUEUE,
        runAt: futureDate({ seconds: 1 })
    });
    console.debug('scheduled additional processing of the queue for one second from now');
};

export const onCheckSignsOfLife = async (event: ScheduledJobEvent<Nothing>, context: TriggerContext) => {
    const members = await context.redis.zRange(RK_SIGNS_OF_LIFE, 0, now(), { by: 'score' });
    if (members.length === 0) {
        console.debug(`there are no users to check, or the key wasn't found - refer to surrounding logs to determine if this is the correct state`);
        return;
    }

    console.debug(`there are ${members.length} users to check`);

    const users = members.slice(0, BS_SIGNS_OF_LIFE).map(x => x.member);
    const states = await Promise.all(users.map(async x => ({ user: x, active: await userIsActive(x, context) })));

    const toCheckAgainLater = states.filter(x => x.active);
    if (toCheckAgainLater.length > 0) {
        const score = future({ days: 1 }).epochMilliseconds;
        await context.redis.zAdd(RK_SIGNS_OF_LIFE, ...toCheckAgainLater.map(x => ({ member: x.user, score })));
        console.debug(`added ${toCheckAgainLater.length} users back to the queue`);
    }

    const toRemoveNow = states.filter(x => !x.active);
    if (toRemoveNow.length > 0) {
        await context.redis.zRem(RK_SIGNS_OF_LIFE, toRemoveNow.map(x => x.user));
        console.debug(`removed ${toRemoveNow.length} users from the queue`);

        for (const { user } of toRemoveNow) {
            const id = user as UserID;
            await delCacheOf(id, context);
            await delTrackingSet(id, context);
            console.debug(`forgot user ${id}, goodbye ${id}`);
        }
    }

    if (members.length > BS_SIGNS_OF_LIFE) {
        await context.scheduler.runJob({
            name: SJ_SIGNS_OF_LIFE,
            runAt: futureDate({ seconds: 5 })
        });
        console.debug('the queue is not yet depleted, scheduled an additional signs of life check for five seconds from now');
    }
};
