import { TriggerContext } from "@devvit/public-api";

export const isRecordEmpty = (record: Record<string, unknown>): boolean => {
    for (const property in record) {
        console.debug('isRecordEmpty', `the given record is not empty, it has the property ${property}`);
        return false;
    }

    console.debug('isRecordEmpty', 'the given record is empty');
    return true;
};

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
            console.debug('userIsActive', `user ${user} is deleted, shadowbanned, suspended, never existed, or has blocked open mod`);
        }

        return result;
    } catch {
        console.debug('userIsActive', `user ${user} is deleted, shadowbanned, suspended, never existed, or has blocked open mod`);
        return false;
    }
};

export const toHash = (object: any) : Record<string,string> => {
    const hash: Record<string, string> = {};

    const entries = Object.entries(object);
    for (const [key, value] of entries) {
        if (!object.hasOwnProperty(key)) {
            continue;
        }

        hash[key] = JSON.stringify(value);
    }

    return hash;
};

export function fromHash<T>(hash: Record<string, string>): T {
    const object: any = {};

    const entries = Object.entries(hash);
    for (const [key, value] of entries) {
        object[key] = JSON.parse(value);
    }

    return object as T;
};
