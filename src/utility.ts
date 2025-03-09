import { TriggerContext } from "@devvit/public-api";
import { now, seconds } from "./temporal.js";

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
