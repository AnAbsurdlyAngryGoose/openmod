import { ModActionType, UserID, SpecialAccountName } from "./types.js";

/** wiki pages */

export const WP_OPEN_MOD_EVENTS = 'open-mod/v2/events';

/** scheduled jobs */

export const SJ_PROCESS_QUEUE = 'process-queue-job';
export const SJ_FORWARD_EVENTS = 'forward-events-job';
export const SJ_SIGNS_OF_LIFE = 'signs-of-life-job';

/** cron expressions */

export const CRON_SIGNS_OF_LIFE = "0 12 * * *"
export const CRON_FORWARD_EVENTS = '* * * * *';

/** redis keys */

export const RK_QUEUE_LAST_REVISION = 'queue-last-revision';
export const RK_EVENTS = 'events';
export const RK_PROCESSING = 'processing';
export const RK_SIGNS_OF_LIFE = 'signs-of-life';
export const RK_TRANSMISSION_QUEUE = 'events-for-processing';

/** batch sizes */

export const BS_EVENTS = 10;
export const BS_SIGNS_OF_LIFE = 50;

/** lookups */

export const SPECIAL_ACCOUNT_NAMES = Object.values(SpecialAccountName) as string[];

export const SPECIAL_ACCOUNT_NAME_TO_ID: Record<string, UserID> = {
    [SpecialAccountName.Reddit]: 't2_spl_rddt',
    [SpecialAccountName.RedditLegal]: 't2_spl_lgl',
    [SpecialAccountName.AntiEvilOperations]: 't2_spl_aeo',
    [SpecialAccountName.Redacted]: 't2_spl_red',
    [SpecialAccountName.Deleted]: 't2_spl_del',
    [SpecialAccountName.Unavailable]: 't2_spl_uvl',
};

export const SPECIAL_ACCOUNT_IDS = Object.values(SPECIAL_ACCOUNT_NAME_TO_ID) as string[];

export const SPECIAL_ACCOUNT_ID_TO_NAME = {
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Reddit]]: SpecialAccountName.Reddit,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.RedditLegal]]: SpecialAccountName.RedditLegal,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.AntiEvilOperations]]: SpecialAccountName.AntiEvilOperations,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Redacted]]: SpecialAccountName.Redacted,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Deleted]]: SpecialAccountName.Deleted,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Unavailable]]: SpecialAccountName.Unavailable,
};

export const MOD_ACTION_PAST_SIMPLE = {
    [ModActionType.RemoveLink]: 'removed a post',
    [ModActionType.SpamLink]: 'marked a post as spam',
    [ModActionType.ApproveLink]: 'approved a post',
    [ModActionType.RemoveComment]: 'removed a comment',
    [ModActionType.SpamComment]: 'marked a comment as spam',
    [ModActionType.ApproveComment]: 'approved a comment',
    [ModActionType.BanUser]: 'banned a user',
    [ModActionType.UnbanUser]: 'unbanned a user',
    [ModActionType.MuteUser]: 'muted a user',
    [ModActionType.UnmuteUser]: 'unmuted a user',
    [ModActionType.LockSubmission]: 'locked a submission',
    [ModActionType.UnlockSubmission]: 'unlocked a submission',
};

export const MOD_ACTION_PREPOSITION = {
    [ModActionType.RemoveLink]: 'from',
    [ModActionType.SpamLink]: 'in',
    [ModActionType.ApproveLink]: 'in',
    [ModActionType.RemoveComment]: 'from',
    [ModActionType.SpamComment]: 'in',
    [ModActionType.ApproveComment]: 'in',
    [ModActionType.BanUser]: 'from',
    [ModActionType.UnbanUser]: 'from',
    [ModActionType.MuteUser]: 'in',
    [ModActionType.UnmuteUser]: 'in',
    [ModActionType.LockSubmission]: 'in',
    [ModActionType.UnlockSubmission]: 'in',
};

export const SUPPORTED_MOD_ACTIONS = Object.values(ModActionType) as string[];
