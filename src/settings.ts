import { Devvit, SettingsFormField, SettingsFormFieldValidatorEvent, TriggerContext } from '@devvit/public-api';

export enum AppSetting {
    TargetSubreddit = 'targetSubredit',
    RecordAdminActions = 'recordAdminActions',
    RecordAutoModeratorActions = 'recordAutoModeratorActions',
    ModerationActions = 'moderationActions',
    ExcludedModerators = 'excludedModerators',
    ExcludedUsers = 'excludedUsers',
    IncludeContext = 'includeContext'
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

const isSubredditNameValid = (event: SettingsFormFieldValidatorEvent<string>, _: Devvit.Context) => {
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
};

export const appSettings: SettingsFormField[] = [
    {
        type: 'string',
        label: 'Destination Subreddit',
        name: AppSetting.TargetSubreddit,
        helpText: 'The subreddit where the application will publicly record moderation actions, without the r/',
        onValidate: isSubredditNameValid
    },
    {
        type: 'group',
        label: 'Public Record Settings',
        helpText: 'In this section, you can configure which users and types of action are excluded from the public record',
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
                    { label: 'Post Removed', value: 'removelink' },
                    { label: 'Post Marked as Spam', value: 'spamlink' },
                    { label: 'Post Approved', value: 'approvelink' },
                    { label: 'Comment Removed', value: 'removecomment' },
                    { label: 'Comment Marked as Spam', value: 'spamcomment' },
                    { label: 'Comment Approved', value: 'approveComment' },
                    { label: 'Submission Locked', value: 'lock' },
                    { label: 'Submission Unlocked', value: 'unlock' },
                    { label: 'User Banned', value: 'banuser' },
                    { label: 'User Unbanned', value: 'unbanuser' },
                    { label: 'User Muted', value: 'muteuser' },
                    { label: 'User Unmuted', value: 'unmuteuser' },
                ],
                defaultValue: [ 'removelink', 'spamlink', 'removecomment', 'spamcomment', 'banuser', 'muteuser' ],
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
            },
            {
                type: 'boolean',
                label: 'Include Context in Public Extract',
                name: AppSetting.IncludeContext,
                helpText: 'If enabled, the public extract will include context for each action, such as the submission title or comment body',
                defaultValue: false
            }
        ]
    }
];

export const isServer = async (context: TriggerContext): Promise<boolean> => {
    const destination = await context.settings.get<string>(AppSetting.TargetSubreddit);

    // we are the server if the target subreddit is not configured
    if (!destination) {
        return true;
    }

    // the server operational mode observes a strange case where the destination subreddit
    // is the same as the one we're executing in
    // this is for a scenario where the user wants to record actions in the same subreddit as
    // they're generated from
    const currentSubreddit = await context.reddit.getCurrentSubredditName();
    return destination.trim().toLowerCase() === currentSubreddit.trim().toLowerCase();
};

export const isClient = async (context: TriggerContext): Promise<boolean> => {
    const destination = await context.settings.get<string>(AppSetting.TargetSubreddit);

    if (!destination) {
        return false;
    }

    // conversely to the server, we assume client operations if a destination is set at all
    return destination.trim().length > 0;
};
