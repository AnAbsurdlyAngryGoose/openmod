import { SettingsValues, TriggerContext } from "@devvit/public-api";
import { ModActionMessage } from "../../protocol.js";
import { ModActionType, CachedComment, CachedPost, CachedUser, CachedSubreddit, ModLogEntry } from "../../types.js";
import { MOD_ACTION_PAST_SIMPLE, MOD_ACTION_PREPOSITION } from "../../constants.js";
import { addExtract, addModAction, getCachedComment, getCachedPost, getCachedSubreddit, getCachedUser } from "../redis.js";
import { getCurrentSubredditName, submitPost } from "../../reddit.js";
import { T1ID, T2ID, T3ID, isT1ID, isT3ID } from "@devvit/shared-types/tid.js";
import { Temporal } from "@js-temporal/polyfill";
import { fromHash } from "../utility.js";
import { AppSetting } from "../../settings.js";
import { MarkdownEntry, blockquote, getMarkdownString, getRenderers, h3, h5, hr, sup, table, text, tsMarkdown } from "ts-markdown";

type ModActionContext = {
    action: ModActionType;
    actionedAt: {
        date: Temporal.PlainDate;
        time: Temporal.PlainTime;
    };
    moderator: CachedUser;
    subreddit: CachedSubreddit;
    targetUser?: CachedUser;
    targetPost?: CachedPost;
    targetComment?: CachedComment;
    modLogEntries?: ModLogEntry[];
    settings: {
        useContext: boolean;
        useMentions: boolean;
        useFullLog: boolean;
    }
};

const getPermalink = (context: ModActionContext): string => {
    if (context.targetComment) {
        let permalink = context.targetComment.permalink;
        if (!permalink.startsWith("https")) {
            permalink = `https://reddit.com${permalink}`;
        }
        return permalink;
    }

    if (context.targetPost) {
        let permalink = context.targetPost.permalink;
        if (!permalink.startsWith("https")) {
            permalink = `https://reddit.com${permalink}`;
        }
        return permalink;
    }

    // if the action involved moderator changes, link to the moderator page
    if (context.action.includes("moderator")) {
        return `https://reddit.com/mod/${context.subreddit.name}/moderators`;
    }

    // for all other scenarios, expect that this is a user-related action e.g. a ban
    if (context.targetUser) {
        return `https://reddit.com/user/${context.targetUser.username}`;
    }

    return "[ unavailable ]";
};

const gatherContext = async (message: ModActionMessage, context: TriggerContext): Promise<ModActionContext> => {
    let targetUser: CachedUser | undefined;
    let targetPost: CachedPost | undefined;
    let targetComment: CachedComment | undefined;

    const moderator = await getCachedUser(message.mod, context);
    const subreddit = await getCachedSubreddit(message.sid, context);
    const modLogEntries = message.log;

    const instant = Temporal.Instant.fromEpochMilliseconds(message.ts);
    const zonedDateTime = instant.toZonedDateTimeISO("UTC");
    const actionedAt = {
        date: zonedDateTime.toPlainDate(),
        time: zonedDateTime.toPlainTime()
    };

    const hash = await context.redis.hGetAll(`settings:${message.sid}`);
    const settingsValues = fromHash<SettingsValues>(hash);
    const settings = {
        useContext: settingsValues[AppSetting.IncludeContext] as boolean ?? false,
        useMentions: settingsValues[AppSetting.UseMentions] as boolean ?? true,
        useFullLog: settingsValues[AppSetting.IncludeFullLog] as boolean ?? false
    }

    // lock, unlock, removelink, spamlink, approvelink
    if ((message.sub.endsWith("lock") && isT3ID(message.tid)) || message.sub.endsWith("link")) {
        targetPost = await getCachedPost(message.tid as T3ID, context);
        targetUser = await getCachedUser(targetPost.author, context);
    }

    // lock, unlock, removecomment, spamcomment, approvecomment
    if ((message.sub.endsWith("lock") && isT1ID(message.tid)) || message.sub.endsWith("comment")) {
        targetComment = await getCachedComment(message.tid as T1ID, context);
        targetUser = await getCachedUser(targetComment.author, context);
    }

    // banuser, unbanuser, muteuser, unmuteuser, addmoderator, invitemoderator,
    // acceptmoderatorinvite, removemoderator, addcontributor, removecontributor
    if (message.sub.endsWith("user") || message.sub.includes("moderator") || message.sub.endsWith("contributor")) {
        targetUser = await getCachedUser(message.tid as T2ID, context);
    }

    return {
        action: message.sub,
        actionedAt,
        moderator,
        subreddit,
        targetUser,
        targetPost,
        targetComment,
        modLogEntries,
        settings
    };
};

const writeTitle = (context: ModActionContext): string => {
    let moderator = context.moderator.username;
    if (context.settings.useMentions) {
        moderator = `u/${moderator}`;
    }

    let subreddit = context.subreddit.name;
    if (context.settings.useMentions) {
        subreddit = `r/${subreddit}`;
    }

    const pastSimple = MOD_ACTION_PAST_SIMPLE[context.action];
    const preposition = MOD_ACTION_PREPOSITION[context.action];

    return `${moderator} ${pastSimple} ${preposition} ${subreddit}`;
};

const writeHeader = (context: ModActionContext): MarkdownEntry => {
    let moderator = context.moderator.username;
    if (context.settings.useMentions) {
        moderator = `u/${moderator}`;
    }

    let subreddit = context.subreddit.name;
    if (context.settings.useMentions) {
        subreddit = `r/${subreddit}`;
    }

    const date = `${context.actionedAt.date.day}/${context.actionedAt.date.month}/${context.actionedAt.date.year}`;
    const time = context.actionedAt.time.toString({ smallestUnit: 'minute' });
    const pastSimple = MOD_ACTION_PAST_SIMPLE[context.action];
    const preposition = MOD_ACTION_PREPOSITION[context.action];

    return h3(text(['On ', date, ', at approximately ', time, ', ', moderator, ' ', pastSimple, ' ', preposition, ' ', subreddit]));
}

const writeLogTable = (context: ModActionContext): MarkdownEntry[] => {
    if (!context.modLogEntries || context.modLogEntries.length === 0) {
        return [];
    }

    return [
        h5("Complete Mod Log"),
        table({
            columns: [ 'Action', 'Moderator', 'Details', 'Description' ],
            rows: context.modLogEntries.map(log => [
                log.type,
                log.moderatorName,
                log.details ?? '',
                log.description ?? ''
            ])
        })
    ];
};

const writeContext = (context: ModActionContext): MarkdownEntry[] => {
    const entries: MarkdownEntry[] = [];

    if (context.targetPost) {
        entries.push(h5("Original Title"));
        entries.push(blockquote(context.targetPost.title));
        if (context.targetPost.body) {
            entries.push(h5("Original Body"));
            entries.push(blockquote(context.targetPost.body));
        }
        entries.push(h5("URL"));
        entries.push(blockquote(context.targetPost.url));
        return entries;
    }

    if (context.targetComment) {
        entries.push(h5("Original Comment"));
        entries.push(blockquote(context.targetComment.body));
    }

    return entries;
}

const writePermalink = (context: ModActionContext): MarkdownEntry[] => {
    return [
        h5("Permalink"),
        blockquote(getPermalink(context))
    ];
};

const writeNotices = (context: ModActionContext): MarkdownEntry[] => {
    return [
        hr(),
        sup("This content was automatically generated, and correct at the time of posting. Changes to the referenced content, such as edits or deletions, may not be reflected here. All times are in UTC.")
    ];
};

export const handleModActionMessage = async (message: ModActionMessage, context: TriggerContext): Promise<void> => {
    const subredditName = await getCurrentSubredditName(context);
    if (!subredditName) {
        throw new Error("handleModActionMessage, i couldn't work out where i am - is reddit down?");
    }

    const ctx = await gatherContext(message, context);
    const title = writeTitle(ctx);

    let markdown: MarkdownEntry[] = [
        writeHeader(ctx),
    ];

    if (ctx.settings.useFullLog) {
        markdown.push(...writeLogTable(ctx));
    }

    if (ctx.settings.useContext) {
        markdown.push(...writeContext(ctx));
    }

    markdown.push(...writePermalink(ctx));
    markdown.push(...writeNotices(ctx));

    const text = tsMarkdown(markdown, {
        renderers: getRenderers({
          sup: (entry, options) => {
            return `^(${getMarkdownString(entry.sup, options)})`;
          }
        })
    });

    const submitted = await submitPost({ subredditName, title, text }, context);
    if (!submitted) {
        throw new Error("handleModActionMessage, failed to submit post");
    }

    const normalised = submitted.id.replace("t3_", "");
    console.debug('handleModActionMessage', `submitted extract https://reddit.com/r/${subredditName}/comments/${normalised}`);

    await addModAction(message.tid, submitted.id, context);
    console.debug('handleModActionMessage', `recorded mod action ${message.tid} -> ${submitted.id}`);

    await addExtract(submitted.id, message, context);
    console.debug('handleModActionMessage', `recorded extract ${submitted.id} -> ${JSON.stringify(message)}`);
};
