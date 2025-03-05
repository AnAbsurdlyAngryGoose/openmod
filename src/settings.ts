import { Devvit, SettingsFormField, SettingsFormFieldValidatorEvent, TriggerContext } from '@devvit/public-api';
import { getCurrentSubredditName } from './reddit.js';
import { ModActionType } from './types.js';

export enum AppSetting {
    TargetSubreddit = 'targetSubredit',
    RecordAdminActions = 'recordAdminActions',
    RecordAutoModeratorActions = 'recordAutoModeratorActions',
    ModerationActions = 'moderationActions',
    ExcludedModerators = 'excludedModerators',
    ExcludedUsers = 'excludedUsers',
    IncludeContext = 'includeContext',
    UseMentions = 'useMentions',
    IncludeFullLog = 'includeFullLog'
};

const hasAtLeastOneOptionSelected = (event: SettingsFormFieldValidatorEvent<string[]>, _: Devvit.Context) => {
    if (!event.value || event.value.length === 0) {
        return 'At least one option must be selected';
    }
};

const listOfExcludedUsersIsValid = (event: SettingsFormFieldValidatorEvent<string>, _: Devvit.Context) => {
    if (!event.value || event.value.trim() === '') {
        return;
    }

    const invalidUsernames = event.value.split(',').map(username => username.trim()).filter(username => !/^[a-zA-Z0-9_-]{3,20}$/.test(username));
    if (invalidUsernames.length > 0) {
        return `The following usernames are too short, too long, or have invalid characters: ${invalidUsernames.join(', ')}`;
    }

    const haveLeadingYouSlash = event.value.split(',').map(username => username.trim().toLocaleLowerCase()).filter(username => username.startsWith('u/'))
    if (haveLeadingYouSlash.length > 0) {
        return `The following usernames have a leading 'u/': ${haveLeadingYouSlash.join(', ')}`;
    }
};

const isSubredditNameValid = async (event: SettingsFormFieldValidatorEvent<string>, context: Devvit.Context) => {
    // it's valid for this to be unset ...
    if (!event.value) return;

    // ... but not for it to be an empty string
    if (event.value.trim().length === 0) {
        return 'The subreddit name cannot be empty';
    }

    if (event.value.startsWith('r/')) {
        return 'The subreddit name should not include the r/';
    }

    // ideally, we also check to see that the intended destination actually exists, but we can't do that yet
    // we simply trust in the universe to provide, or something
    // yeah, that's it
    try {
        await context.reddit.getSubredditInfoByName(event.value);
    } catch {
        return 'The subreddit does not exist or is private. If it\'s private, you will need to install Open Mod there before you can configure it here.';
    }
};

export const appSettings: SettingsFormField[] = [
    {
        type: 'group',
        label: 'General Configuration',
        helpText: 'In this section, you can configure the basic settings for the application',
        fields: [
            {
                type: 'string',
                label: 'Destination Subreddit',
                name: AppSetting.TargetSubreddit,
                helpText: 'The subreddit where the application will publicly record moderation actions, without the r/. This should only be set in the subreddit from which you want to create a public mod log.',
                onValidate: isSubredditNameValid
            }
        ]
    },
    {
        type: 'group',
        label: 'Filtering Configuration',
        helpText: 'In this section, you can configure the types of actions that will be recorded in the public log, as well as any exclusions',
        fields: [
            {
                type: 'boolean',
                label: 'Record Actions by Reddit Administrators',
                name: AppSetting.RecordAdminActions,
                helpText: 'If enabled, actions taken by Reddit administrators will be recorded in the public log',
                defaultValue: true
            },
            {
                type: 'boolean',
                label: 'Record Actions by AutoModerator',
                name: AppSetting.RecordAutoModeratorActions,
                helpText: 'If enabled, actions taken by AutoModerator will be recorded in the public log',
                defaultValue: false
            },
            {
                type: 'select',
                label: 'Moderation Actions to Record',
                name: AppSetting.ModerationActions,
                helpText: 'Select the types of moderation actions that will be recorded in the public log',
                multiSelect: true,
                options: [
                    { label: 'Post Removed', value: ModActionType.RemoveLink },
                    { label: 'Post Marked as Spam', value: ModActionType.SpamLink },
                    { label: 'Post Approved', value: ModActionType.ApproveLink },
                    { label: 'Comment Removed', value: ModActionType.RemoveComment },
                    { label: 'Comment Marked as Spam', value: ModActionType.SpamComment},
                    { label: 'Comment Approved', value: ModActionType.ApproveComment },
                    { label: 'Submission Locked', value: ModActionType.LockSubmission },
                    { label: 'Submission Unlocked', value: ModActionType.UnlockSubmission },
                    { label: 'User Banned', value: ModActionType.BanUser },
                    { label: 'User Unbanned', value: ModActionType.UnbanUser },
                    { label: 'User Muted', value: ModActionType.MuteUser },
                    { label: 'User Unmuted', value: ModActionType.UnmuteUser },

                    // v1.3
                    { label: 'Moderator Added (by Reddit)', value: ModActionType.AddModerator },
                    { label: 'Moderator Invited', value: ModActionType.InviteModerator },
                    { label: 'Moderator Accepted an Invite', value: ModActionType.AcceptModeratorInvite },
                    { label: 'Moderator Removed', value: ModActionType.RemoveModerator },
                    { label: 'Approved a User', value: ModActionType.AddContributor },
                    { label: 'Removed an Approved User', value: ModActionType.RemoveContributor }
                ],
                defaultValue: [ ModActionType.RemoveLink, ModActionType.SpamLink, ModActionType.RemoveComment, ModActionType.SpamComment, ModActionType.BanUser, ModActionType.MuteUser ],
                onValidate: hasAtLeastOneOptionSelected
            },
            {
                type: 'string',
                label: 'Do Not Record Actions by These Moderators',
                name: AppSetting.ExcludedModerators,
                helpText: 'Enter the usernames of moderators whose actions should not be recorded in the public log, separated by commas, without the u/',
                onValidate: listOfExcludedUsersIsValid
            },
            {
                type: 'string',
                label: 'Do Not Record Actions Against These Users',
                name: AppSetting.ExcludedUsers,
                helpText: 'Enter the usernames of users whose actions should not be recorded in the public log, separated by commas, without the u/',
                onValidate: listOfExcludedUsersIsValid
            }
        ]
    },
    {
        type: 'group',
        label: 'Content Configuration',
        helpText: 'In this section, you can configure the content of the public log',
        fields: [
            {
                type: 'boolean',
                label: 'Include Context in Public Extracts',
                name: AppSetting.IncludeContext,
                helpText: 'If enabled, the public extract will include context for each action, such as the submission title or comment body',
                defaultValue: false
            },
            {
                type: 'boolean',
                label: 'Use User and Subreddit Mentions in Public Extracts',
                name: AppSetting.UseMentions,
                helpText: 'If enabled, usernames and subreddits in the public extract will be formatted as mentions (e.g. they will include u/ or r/, respectively).',
                defaultValue: true
            },
            {
                type: 'boolean',
                label: 'Include Full Log in Public Extracts',
                name: AppSetting.IncludeFullLog,
                helpText: 'If enabled, the public extract will include the full log of the moderated thing, rather than just the action that was taken. Please note that the log will only be complete up to the time of posting the extract.',
                defaultValue: false
            }
        ]
    }
];

export const isServer = async (context: TriggerContext): Promise<boolean> => {
    const destination = await context.settings.get<string>(AppSetting.TargetSubreddit);

    // we are the server if the target subreddit is not configured or is an empty string
    if (!destination || destination.trim().length === 0) {
        return true;
    }

    // the server operational mode observes a strange case where the destination subreddit
    // is the same as the one we're executing in
    // this is for a scenario where the user wants to record actions in the same subreddit as
    // they're generated from
    const currentSubreddit = await getCurrentSubredditName(context);
    if (!currentSubreddit) {
        // couldn't get info about the subreddit, so let's just assume we're the server
        return true;
    }

    return destination.trim().toLowerCase() === currentSubreddit.trim().toLowerCase();
};

export const isClient = async (context: TriggerContext): Promise<boolean> => {
    const destination = await context.settings.get<string>(AppSetting.TargetSubreddit);

    // we are not the client if the destination subreddit is not configured or is an empty string
    if (!destination || destination.trim().length === 0) {
        return false;
    }

    // conversely to the server, we assume client operations if a destination is set at all
    return destination.trim().length > 0;
};

export type AppSettings = {
    targetSubreddit: string;
    recordAdminActions: boolean;
    recordAutoModeratorActions: boolean;
    moderationActions: ModActionType[];
    excludedModerators: string;
    excludedUsers: string;
    includeContext: boolean;
    useMentions: boolean;
    includeFullLog: boolean;
};

export const getAllSettings = async (context: TriggerContext): Promise<AppSettings> => {
    const settings = await context.settings.getAll();

    return {
        targetSubreddit: settings[AppSetting.TargetSubreddit] as string,
        recordAdminActions: settings[AppSetting.RecordAdminActions] as boolean,
        recordAutoModeratorActions: settings[AppSetting.RecordAutoModeratorActions] as boolean,
        moderationActions: settings[AppSetting.ModerationActions] as ModActionType[],
        excludedModerators: settings[AppSetting.ExcludedModerators] as string,
        excludedUsers: settings[AppSetting.ExcludedUsers] as string,
        includeContext: settings[AppSetting.IncludeContext] as boolean,
        useMentions: settings[AppSetting.UseMentions] as boolean,
        includeFullLog: settings[AppSetting.IncludeFullLog] as boolean
    };
};
