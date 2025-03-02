import { TriggerContext } from "@devvit/public-api";
import { now, seconds } from "./temporal.js";

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
