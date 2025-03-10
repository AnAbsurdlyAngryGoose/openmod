import { AppUpgrade, AppInstall } from "@devvit/protos";
import { TriggerContext } from "@devvit/public-api";
import { CRON_FORWARD_EVENTS, SJ_FORWARD_EVENTS, SJ_SIGNS_OF_LIFE, CRON_SIGNS_OF_LIFE, RK_PROCESSING } from "./constants.js";

export const onAppInstallAndUpgrade = async (_: AppInstall | AppUpgrade, context: TriggerContext) => {
    const scheduledJobs = await context.scheduler.listJobs();
    await Promise.all(scheduledJobs.map(job => context.scheduler.cancelJob(job.id)));
    console.debug(`cancelled ${scheduledJobs.length} existing jobs`);

    const sjForwardEvents = await context.scheduler.runJob({
        name: SJ_FORWARD_EVENTS,
        cron: CRON_FORWARD_EVENTS
    });
    console.debug(`scheduled ${SJ_FORWARD_EVENTS}, it is job ${sjForwardEvents}`);

    const sjSignsOfLife = await context.scheduler.runJob({
        name: SJ_SIGNS_OF_LIFE,
        cron: CRON_SIGNS_OF_LIFE
    });
    console.debug(`scheduled ${SJ_SIGNS_OF_LIFE}, it is job ${sjSignsOfLife}`);

    await context.redis.del(RK_PROCESSING);
    console.debug(`cleared ${RK_PROCESSING}`);
};
