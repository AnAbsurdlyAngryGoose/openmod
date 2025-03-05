import { AppUpgrade, AppInstall } from "@devvit/protos";
import { TriggerContext } from "@devvit/public-api";
import { CRON_FORWARD_EVENTS, SJ_FORWARD_EVENTS, SJ_SIGNS_OF_LIFE, CRON_SIGNS_OF_LIFE, RK_SIGNATURE_JWK, WP_OPEN_MOD_SIGNATURE_JWK, RK_HANDSHAKE_JWK, WP_OPEN_MOD_HANDSHAKE_JWK, WP_APP_VERSION, SJ_PROCESS_QUEUE, CRON_PROCESS_EVENTS } from "./constants.js";

const restartJobs = async (context: TriggerContext) => {
    const scheduledJobs = await context.scheduler.listJobs();
    await Promise.all(scheduledJobs.map(job => context.scheduler.cancelJob(job.id)));
    console.debug('restartJobs', `cancelled ${scheduledJobs.length} existing jobs`);

    const sjForwardEvents = await context.scheduler.runJob({
        name: SJ_FORWARD_EVENTS,
        cron: CRON_FORWARD_EVENTS
    });
    console.debug('restartJobs', `scheduled ${SJ_FORWARD_EVENTS}, it is job ${sjForwardEvents}`);

    const sjSignsOfLife = await context.scheduler.runJob({
        name: SJ_SIGNS_OF_LIFE,
        cron: CRON_SIGNS_OF_LIFE
    });
    console.debug('restartJobs', `scheduled ${SJ_SIGNS_OF_LIFE}, it is job ${sjSignsOfLife}`);

    const sjProcessEvents = await context.scheduler.runJob({
        name: SJ_PROCESS_QUEUE,
        cron: CRON_PROCESS_EVENTS
    });
    console.debug('restartJobs', `scheduled ${SJ_PROCESS_QUEUE}, it is job ${sjProcessEvents}`);
};

const checkAndRefreshHandshakeKeys = async (context: TriggerContext) => {
    const handshakeKeys = await context.redis.hGetAll(RK_HANDSHAKE_JWK);
    if (!handshakeKeys.private || !handshakeKeys.public) {
        console.debug('checkAndRefreshHandshakeKeys', 'generating handshake keys');
        const key = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);

        const jwkPriv = await crypto.subtle.exportKey('jwk', key.privateKey);
        const jwkPub = await crypto.subtle.exportKey('jwk', key.publicKey);

        handshakeKeys.private = JSON.stringify(jwkPriv);
        handshakeKeys.public = JSON.stringify(jwkPub);

        await context.redis.hSet(RK_HANDSHAKE_JWK, handshakeKeys);
        console.debug('checkAndRefreshHandshakeKeys', `saved keys to ${RK_HANDSHAKE_JWK}`);
    }

    await context.reddit.updateWikiPage({
        subredditName: await context.reddit.getCurrentSubredditName(),
        page: WP_OPEN_MOD_HANDSHAKE_JWK,
        content: handshakeKeys.public
    });
    console.debug('checkAndRefreshHandshakeKeys', `refreshed public key at ${WP_OPEN_MOD_HANDSHAKE_JWK}`);
};

const checkAndRefreshSignatureKeys = async (context: TriggerContext) => {
    const signatureKeys = await context.redis.hGetAll(RK_SIGNATURE_JWK);
    if (!signatureKeys.private || !signatureKeys.public) {
        console.debug('checkAndRefreshSignatureKeys', 'generating signing keys');
        const key = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);

        const jwkPriv = await crypto.subtle.exportKey('jwk', key.privateKey);
        const jwkPub = await crypto.subtle.exportKey('jwk', key.publicKey);

        signatureKeys.private = JSON.stringify(jwkPriv);
        signatureKeys.public = JSON.stringify(jwkPub);

        await context.redis.hSet(RK_SIGNATURE_JWK, signatureKeys);
        console.debug('checkAndRefreshSignatureKeys', `saved keys to ${RK_SIGNATURE_JWK}`);
    }

    await context.reddit.updateWikiPage({
        subredditName: await context.reddit.getCurrentSubredditName(),
        page: WP_OPEN_MOD_SIGNATURE_JWK,
        content: signatureKeys.public
    });
    console.debug('checkAndRefreshSignatureKeys', `refreshed public key at ${WP_OPEN_MOD_SIGNATURE_JWK}`);
};

const writeVersionToWiki = async (context: TriggerContext) => {
    await context.reddit.updateWikiPage({
        subredditName: await context.reddit.getCurrentSubredditName(),
        page: WP_APP_VERSION,
        content: context.appVersion
    });
    console.debug('writeVersionToWiki', `wrote app version (${context.appVersion}) to ${WP_APP_VERSION}`);
};

export const onAppInstallAndUpgrade = async (_: AppInstall | AppUpgrade, context: TriggerContext) => {
    await restartJobs(context);
    console.debug('onAppInstallAndUpgrade', 'restarted jobs');

    await checkAndRefreshHandshakeKeys(context);
    console.debug('onAppInstallAndUpgrade', 'checked and refreshed handshake keys');

    await checkAndRefreshSignatureKeys(context);
    console.debug('onAppInstallAndUpgrade', 'checked and refreshed signature keys');

    await writeVersionToWiki(context);
    console.debug('onAppInstallAndUpgrade', 'wrote version to wiki');
};
