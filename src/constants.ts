import { T2ID } from "@devvit/shared-types/tid.js";
import { ModActionType, SpecialAccountName } from "./types.js";

/** wiki pages */

export const WP_OPEN_MOD_EVENTS = 'open-mod/v2/events';
export const WP_OPEN_MOD_SIGNATURE_JWK = 'open-mod/v3/cryptography/ecdsa';
export const WP_OPEN_MOD_HANDSHAKE_JWK = 'open-mod/v3/cryptography/ecdh';
export const WP_APP_VERSION = 'open-mod/v3/version';

/** scheduled jobs */

export const SJ_PROCESS_QUEUE = 'process-queue-job';
export const SJ_FORWARD_EVENTS = 'forward-events-job';
export const SJ_SIGNS_OF_LIFE = 'signs-of-life-job';
export const SJ_DELAYED_MOD_ACTION_PROCESSING = 'delayed-mod-action-processing-job';

/** cron expressions */

export const CRON_SIGNS_OF_LIFE = "0 12 * * *"
export const CRON_FORWARD_EVENTS = '* * * * *';
export const CRON_PROCESS_EVENTS = '* * * * *';

/** redis keys */

export const RK_QUEUE_LAST_REVISION = 'queue-last-revision';
export const RK_EVENTS = 'events';
export const RK_SIGNS_OF_LIFE = 'signs-of-life';
export const RK_TRANSMISSION_QUEUE = 'events-for-processing';
export const RK_SIGNATURE_JWK = 'signature-jwk';
export const RK_HANDSHAKE_JWK = 'handshake-jwk';
export const RK_LAST_KNOWN_SETTINGS = 'last-known-settings';

/** batch sizes */

export const BS_EVENTS = 50;
export const BS_SIGNS_OF_LIFE = 50;

/** lookups */

export const SPECIAL_ACCOUNT_NAMES = Object.values(SpecialAccountName) as string[];

export const SPECIAL_ACCOUNT_NAME_TO_ID: Record<string, T2ID> = {
    [SpecialAccountName.Reddit]: 't2_spl_rddt',
    [SpecialAccountName.RedditLegal]: 't2_spl_lgl',
    [SpecialAccountName.AntiEvilOperations]: 't2_spl_aeo',
    [SpecialAccountName.Redacted]: 't2_spl_red',
    [SpecialAccountName.Deleted]: 't2_spl_del',
    [SpecialAccountName.Unavailable]: 't2_spl_uvl',
    [SpecialAccountName.ModCodeOfConduct]: 't2_spl_mcc',
};

export const SPECIAL_ACCOUNT_IDS = Object.values(SPECIAL_ACCOUNT_NAME_TO_ID) as string[];

export const SPECIAL_ACCOUNT_ID_TO_NAME = {
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Reddit]]: SpecialAccountName.Reddit,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.RedditLegal]]: SpecialAccountName.RedditLegal,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.AntiEvilOperations]]: SpecialAccountName.AntiEvilOperations,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Redacted]]: SpecialAccountName.Redacted,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Deleted]]: SpecialAccountName.Deleted,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Unavailable]]: SpecialAccountName.Unavailable,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.ModCodeOfConduct]]: SpecialAccountName.ModCodeOfConduct,
};

export const MOD_ACTION_TARGET_NOUN = {
    // vInitial
    [ModActionType.RemoveLink]: 'Author',
    [ModActionType.SpamLink]: 'Author',
    [ModActionType.ApproveLink]: 'Author',
    [ModActionType.RemoveComment]: 'Author',
    [ModActionType.SpamComment]: 'Author',
    [ModActionType.ApproveComment]: 'Author',
    [ModActionType.BanUser]: 'Banned User',
    [ModActionType.UnbanUser]: 'Unbanned User',
    [ModActionType.MuteUser]: 'Muted User',
    [ModActionType.UnmuteUser]: 'Unmuted User',
    [ModActionType.LockSubmission]: 'Author',
    [ModActionType.UnlockSubmission]: 'Author',

    // v1.3
    [ModActionType.AddModerator]: 'New Moderator',
    [ModActionType.InviteModerator]: 'New Moderator',
    [ModActionType.AcceptModeratorInvite]: 'New Moderator',
    [ModActionType.RemoveModerator]: 'Removed Moderator',
    [ModActionType.AddContributor]: 'Newly Approved User',
    [ModActionType.RemoveContributor]: 'Previously Approved User',
};

export const MOD_ACTION_PAST_SIMPLE = {
    // vInitial
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

    // v1.3
    [ModActionType.AddModerator]: 'added a moderator',
    [ModActionType.InviteModerator]: 'invited a moderator',
    [ModActionType.AcceptModeratorInvite]: 'accepted an invitation to moderate',
    [ModActionType.RemoveModerator]: 'removed a moderator',
    [ModActionType.AddContributor]: 'added an approved submitter',
    [ModActionType.RemoveContributor]: 'removed an approved submitter',
};

export const MOD_ACTION_PREPOSITION = {
    // vInitial
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

    // v1.3
    [ModActionType.AddModerator]: 'to',
    [ModActionType.InviteModerator]: 'to',
    [ModActionType.AcceptModeratorInvite]: '', // no preposition for accepting, which we need to account for in handlemodaction
    [ModActionType.RemoveModerator]: 'from',
    [ModActionType.AddContributor]: 'to',
    [ModActionType.RemoveContributor]: 'from',
};

export const SUPPORTED_MOD_ACTIONS = Object.values(ModActionType) as string[];
