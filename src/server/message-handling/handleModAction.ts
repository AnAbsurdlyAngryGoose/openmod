import { TriggerContext } from "@devvit/public-api";
import { ModActionMessage, ProtocolEvent, ProtocolMessage } from "../../protocol.js";
import { CommentID, ModActionType, PostID, UserID, CachedComment, CachedPost, CachedUser, SpecialAccountName } from "../../types.js";
import { MOD_ACTION_PAST_SIMPLE, MOD_ACTION_PREPOSITION } from "../../constants.js";
import { addModAction, getCachedComment, getCachedPost, getCachedUser } from "../redis.js";
import { isCommentID, isPostID } from "../utility.js";
import { getCurrentSubredditName, getSubredditInfoById, submitPost } from "../../reddit.js";

const isModEvent = (message: ProtocolMessage): message is ModActionMessage => {
    return message.type === ProtocolEvent.ModAction;
};

const writeTitle = (action: ModActionType, moderator: string, subreddit: string): string => {
    const pastSimple = MOD_ACTION_PAST_SIMPLE[action];
    const preposition = MOD_ACTION_PREPOSITION[action];

    return `u/${moderator} ${pastSimple} ${preposition} r/${subreddit}`;
};

interface ModActionContext {
    user: CachedUser;
    comment?: CachedComment;
    post?: CachedPost;
    permalink: string;
};

const gatherContext = async (message: ModActionMessage, context: TriggerContext): Promise<ModActionContext> => {
    if ((message.sub.endsWith("lock") && isPostID(message.tid)) || message.sub.endsWith("link")) {
        const post = await getCachedPost(message.tid as PostID, context);
        const user = await getCachedUser(post.author, context);
        return { user, post, permalink: post.permalink };
    }

    if ((message.sub.endsWith("lock") && isCommentID(message.tid)) || message.sub.endsWith("comment")) {
        const comment = await getCachedComment(message.tid as CommentID, context);
        const user = await getCachedUser(comment.author, context);
        return { user, comment, permalink: comment.permalink };
    }

    if (message.sub.endsWith("user")) {
        const user = await getCachedUser(message.tid as UserID, context);
        return { user, permalink: `https://www.reddit.com/user/${user.username}` };
    }

    throw new Error ("unknown mod action type");
};

export const handleModActionMessage = async (message: ProtocolMessage, context: TriggerContext): Promise<void> => {
    if (!isModEvent(message)) {
        console.error(`i find myself in a strange situation, where message is not a modaction: ${JSON.stringify(message)}}`);
        return;
    }

    const subredditName = await getCurrentSubredditName(context);
    if (!subredditName) {
        throw new Error("i couldn't work out where i am - is reddit down?");
    }

    const moderator = await getCachedUser(message.mod, context);

    const subreddit = await getSubredditInfoById(message.sid, context);
    if (!moderator || !subreddit || !subreddit.name) {
        console.error("failed to read moderator or subreddit info");
        return;
    }

    const title = writeTitle(message.sub, moderator.username, subreddit.name);

    let text = `${title}\n\n`;

    const { user, post, comment, permalink } = await gatherContext(message, context);
    if (user) {
        text += `Author: ${user.username}${user.isAdmin ? " (admin)" : ""}${user.isApp ? " (app)" : ""}\n\n`;
    } else {
        text += `Author: ${SpecialAccountName.Unavailable}\n\n`;
    }

    text += `Moderator: ${moderator.username}${moderator.isAdmin ? " (admin)" : ""}${moderator.isApp ? " (app)" : ""}\n\n`;
    text += `Action: ${message.sub}\n\n`;

    if (message.ctx && (post || comment)) {
        text += `Context:\n\n`;
        text += '```\n';

        if (post) {
            text += `Title: ${post.title}`;
            if (post.body) {
                text += `\n\n${post.body}`;
            }
        } else if (comment) {
            text += comment.body;
        } else {
            text += `Not applicable.`;
        }

        text += '\n```\n\n';
    }

    text += `Permalink:\n\n${permalink.startsWith("https") ? "" : "https://reddit.com"}${permalink}\n\n\n\n`;
    text += `^(This content was automatically generated, and correct as of the time of posting. Changes to the content, such as edits or deletions, may not be reflected here.)`;

    const submitted = await submitPost({ subredditName, title, text }, context);
    if (!submitted) {
        throw new Error("failed to submit post");
    }

    const normalised = submitted.id.replace("t3_", "");
    console.debug(`submitted extract https://reddit.com/r/${subredditName}/comments/${normalised}`);

    await addModAction(message.tid, submitted.id, context);
    console.debug(`added mod action ${message.tid} -> ${submitted.id}`);
};
