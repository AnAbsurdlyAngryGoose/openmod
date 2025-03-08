import { ModAction, TriggerContext } from "@devvit/public-api";
import { ModActionMessage, ProtocolEvent, ProtocolMessage } from "../../protocol.js";
import { CommentID, ModActionType, PostID, UserID, CachedComment, CachedPost, CachedUser, SpecialAccountName, CachedSubreddit } from "../../types.js";
import { MOD_ACTION_PAST_SIMPLE, MOD_ACTION_PREPOSITION, MOD_ACTION_TARGET_NOUN } from "../../constants.js";
import { addExtract, addModAction, getCachedComment, getCachedPost, getCachedSubreddit, getCachedUser } from "../redis.js";
import { isCommentID, isPostID } from "../utility.js";
import { getCurrentSubredditName, submitPost } from "../../reddit.js";

type ModActionContext = {
    action: ModActionType;
    moderator: CachedUser;
    subreddit: CachedSubreddit;
    targetUser?: CachedUser;
    targetPost?: CachedPost;
    targetComment?: CachedComment;
    modLog?: ModAction
};

const isModEvent = (message: ProtocolMessage): message is ModActionMessage => {
    return message.type === ProtocolEvent.ModAction;
};

const writeTitle = (context: ModActionContext): string => {
    let title = `u/${context.moderator.username}`;

    const pastSimple = MOD_ACTION_PAST_SIMPLE[context.action];
    if (pastSimple.trim().length > 0) {
        title += ` ${pastSimple}`;
    }

    const preposition = MOD_ACTION_PREPOSITION[context.action];
    if (preposition.trim().length > 0) {
        title += ` ${preposition}`;
    }

    title += ` r/${context.subreddit.name}`;
    return title;
};

const getModerationLog = async (id: string, subredditName: string, moderator: string, context: TriggerContext): Promise<ModAction | undefined> => {
    const moderationLog = await context.reddit.getModerationLog({
        subredditName,
        moderatorUsernames: [moderator],
        limit: 50,
    }).all();

    const modAction = moderationLog.find((log) => log.id === id);
    if (!modAction) {
        console.error(`getModerationLog, failed to find mod action ${id}`);
    }

    return modAction;
};

const getPermalink = (context: ModActionContext): string => {
    if (context.targetComment) {
        return context.targetComment.permalink;
    }

    if (context.targetPost) {
        return context.targetPost.permalink;
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

    let modLog: ModAction | undefined;
    if (message.mid) {
         modLog = await getModerationLog(message.mid, subreddit.name, moderator.username, context);
    }

    // lock, unlock, removelink, spamlink, approvelink
    if ((message.sub.endsWith("lock") && isPostID(message.tid)) || message.sub.endsWith("link")) {
        targetPost = await getCachedPost(message.tid as PostID, context);
        targetUser = await getCachedUser(targetPost.author, context);
    }

    // lock, unlock, removecomment, spamcomment, approvecomment
    if ((message.sub.endsWith("lock") && isCommentID(message.tid)) || message.sub.endsWith("comment")) {
        targetComment = await getCachedComment(message.tid as CommentID, context);
        targetUser = await getCachedUser(targetComment.author, context);
    }

    // banuser, unbanuser, muteuser, unmuteuser, addmoderator, invitemoderator,
    // acceptmoderatorinvite, removemoderator, addcontributor, removecontributor
    if (message.sub.endsWith("user") || message.sub.includes("moderator") || message.sub.endsWith("contributor")) {
        targetUser = await getCachedUser(message.tid as UserID, context);
    }

    return {
        action: message.sub,
        moderator,
        subreddit,
        targetUser,
        targetPost,
        targetComment,
        modLog
    };
};

export const handleModActionMessage = async (message: ProtocolMessage, context: TriggerContext): Promise<void> => {
    if (!isModEvent(message)) {
        console.error('handleModActionMessage', `i find myself in a strange situation, where message is not a modaction: ${JSON.stringify(message)}}`);
        return;
    }

    const subredditName = await getCurrentSubredditName(context);
    if (!subredditName) {
        throw new Error("handleModActionMessage, i couldn't work out where i am - is reddit down?");
    }

    const ctx = await gatherContext(message, context);
    const title = writeTitle(ctx);
    let text = `${title}\n\n`;

    const noun = MOD_ACTION_TARGET_NOUN[ctx.action];
    if (ctx.targetUser) {
        text += `${noun}: ${ctx.targetUser.username}${ctx.targetUser.isAdmin ? " (admin)" : ""}${ctx.targetUser.isApp ? " (app)" : ""}\n\n`;
    } else {
        text += `${noun}: ${SpecialAccountName.Unavailable}\n\n`;
    }

    text += `Moderator: ${ctx.moderator.username}${ctx.moderator.isAdmin ? " (admin)" : ""}${ctx.moderator.isApp ? " (app)" : ""}\n\n`;
    text += `Action: ${message.sub}\n\n`;

    if (message.ctx && (ctx.targetPost || ctx.targetComment)) {
        text += `Context:\n\n`;
        text += '```\n';

        if (ctx.targetPost) {
            text += `Title: ${ctx.targetPost.title}`;
            if (ctx.targetPost.body) {
                text += `\n\n${ctx.targetPost.body}`;
            }
        } else if (ctx.targetComment) {
            text += ctx.targetComment.body;
        } else {
            text += `Not applicable.`;
        }

        text += '\n```\n\n';
    }

    const permalink = getPermalink(ctx);
    text += `Permalink:\n\n${permalink.startsWith("https") ? "" : "https://reddit.com"}${permalink}\n\n\n\n`;
    text += `^(This content was automatically generated, and correct as of the time of posting. Changes to the content, such as edits or deletions, may not be reflected here.)`;

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
