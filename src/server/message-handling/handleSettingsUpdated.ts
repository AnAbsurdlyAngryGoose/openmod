import { TriggerContext } from "@devvit/public-api";
import { SettingsUpdatedMessage } from "../../protocol.js";
import { toHash } from "../utility.js";

export const handleSettingsUpdatedMessage = async (message: SettingsUpdatedMessage, context: TriggerContext): Promise<void> => {
    const settings = message.settings;

    // support for an n-1 relationship with reporting subreddits
    const key = `settings:${message.sid}`;

    const hash = toHash(settings);
    await context.redis.hSet(key, hash);
};
