Open Mod is a small application that reproduces a public extract of your subreddit's moderation log, enabling greater transparency for moderation teams and empowering users to better understand how your community is moderated.

The application is triggered when a moderation action is taken. Information about the moderation action, including but not limited to the type, actor, target, and relevant submission is collated, and then formatted for submission in the configured _destination_ subreddit.

The application is additionally triggered upon the deletion of a submission. In this instance, data held about that submission is removed. See [data stored](#data-stored) for more information.

**By using Open Mod you agree to extracts from your moderation log being made publicly available.**

## Installing Open Mod

To install Open Mod, please add the application to the community from which you would like to reproduce mod logs (the "origin") and the community to which you would like to publish them (the "destination").

You must then configure the application in the "origin" community.

Example: I would like to publish logs from r/FancySubreddit to r/FancySubredditLogs.

Steps:

- Install the application in r/FancySubreddit.
- Install the application in r/FancySubredditLogs.
- In r/FancySubreddit, configure the application by setting "Destination Subreddit" to "FancySubredditLogs" (without quotes).
- Optionally, in r/FancySubreddit, adjust the remaining settings to my liking.

### Unsupported Scenarios

Publishing logs to the community from which they originate is **not currently supported**.

Publishing to a single subreddit (e.g. r/FancySubredditLogs) from multiple subreddits (e.g. r/FancySub1, r/FancySub2) is **not currently supported**.

If any of the scenarios in this section would be immediately useful to you, please get in touch via my Reddit DMs! Knowing what you need will help me prioritise and plan improvements.

## Configuration

Open Mod is configurable, and supports the following options.

- **(Required)** The subreddit in which to post the public extracts,
- Whether or not to include Reddit admins in the public extract,
- Whether or not to include automoderator in the public extract,
- Whether or not to include cached submission content in the public extract,
- Selection of which moderation actions to create extracts from,
- A list of moderators to exclude from the public extract, and
- A list of users to exclude from the public extract

By default, Open Mod only creates extracts for bans (but not unbans), mutes (but not unmutes), removing posts or marking them as spam, and removing comments or marking them as spam.

Configuration is synchronised between your paired installations. Changes to the configuration may take up to an hour to be reflected in your public extract.

## Data Stored

Open Mod stores metadata including `t1` and `t3` identifiers, creation timestamps, permalinks, moderation action types, and account metadata, f.ex. whether the account is a Reddit admin. Additionally, identifiable data including `t2` identifiers and submitted content may also be cached for later retrieval.

Data is stored securely, and cannot be access by the developers, moderators, or users.

Data is ring-fenced in your subreddit, and cannot be accessed by installations of Open Mod in other subreddits.

If you remove Open Mod from your subreddit, all data collected up to that point is deleted.

Open Mod implements the [Content Deletion Policy](https://developers.reddit.com/docs/guidelines#content-deletion-policy).

## About

This app is open source and licenced under the [AGPL v3](https://choosealicense.com/licenses/agpl-3.0/) licence. You can find the source code on GitHub [here](https://github.com/AnAbsurdlyAngryGoose/openmod).

With special thanks to u/xenc for their help testing the app, and to u/fsv for their support implementing CDP enforcement (and for inspiring the format of this README).

## Change History

### v2

- **Open Mod v2 is not compatible with versions 1.3.5 and earlier.**
- The application now enforces parity between instances.
- Extracts are now recorded internally for future contextualisation.
- Messages are now compressed in transit.
- Extracts can now optionally include the complete mod log.
- It is now possible to toggle user and subreddit mentions.
- Settings are now synchronised between installations.

### v1.3.5

- Fix an issue where the processing loop could unexpectedly hang.

### v1.3.4

- Fix an issue where admin and automoderator actions may be reported when they shouldn't.

### v1.3.2

- Updated this document.

### v1.3

- Open Mod now supports reproducing logs when:
  - Adding or removing an approved user, and
  - Adding, inviting, or removing a moderator, and
  - Accepting an invite to moderate.
- Fix a potential issue where actions by u/ModCodeofConduct might not be correctly attributed.

### v1.2.1

- Miscellaneous fixes.

### v1.2

- Fixes an issue that prevented the proper operation of Open Mod.
- Public extracts may now include a cached copy of moderated content.
  - This option is configurable, and **disabled** by default.
- Extract titles now include the originating subreddit name.

### v1.0.1

- Actions taken against the subreddit mod team pseudo-account are now excluded from the public extract.

### v1.0

Initial version of Open Mod published.

- Support for links (remove, approve, spam), comments (remove, approve, spam), bans and unbans, and mutes and unmutes.
- Enforcement of CDP when a user deletes their submission, their account, or when they are suspended.
