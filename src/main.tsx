import { Devvit } from "@devvit/public-api";
import { onWikiRevision, onProcessMessageQueue, onCheckSignsOfLife } from "./server/index.js";
import { onCommentChanged, onDelayedModAction, onForwardEvents, onModAction, onPostChanged, onThingDeleted } from "./client/index.js";
import { appSettings } from "./settings.js";
import { onAppInstallAndUpgrade } from "./installEvents.js";
import { SJ_DELAYED_MOD_ACTION_PROCESSING, SJ_FORWARD_EVENTS, SJ_PROCESS_QUEUE, SJ_SIGNS_OF_LIFE } from "./constants.js";

Devvit.configure({ redditAPI: true, redis: true });

Devvit.addSettings(appSettings);

/** client */

Devvit.addTrigger({
    events: [ 'CommentSubmit', 'CommentUpdate' ],
    onEvent: onCommentChanged
});

Devvit.addTrigger({
    events: [ 'PostSubmit', 'PostUpdate' ],
    onEvent: onPostChanged
});

Devvit.addTrigger({
    events: [ 'CommentDelete', 'PostDelete' ],
    onEvent: onThingDeleted
});

Devvit.addTrigger({
    event: 'ModAction',
    onEvent: onModAction
});

Devvit.addSchedulerJob({
    name: SJ_FORWARD_EVENTS,
    onRun: onForwardEvents
});

Devvit.addSchedulerJob({
    name: SJ_DELAYED_MOD_ACTION_PROCESSING,
    onRun: onDelayedModAction
});

/** server */

Devvit.addTrigger({
    event: 'ModAction',
    onEvent: onWikiRevision
});

Devvit.addSchedulerJob({
    name: SJ_PROCESS_QUEUE,
    onRun: onProcessMessageQueue
});

Devvit.addSchedulerJob({
    name: SJ_SIGNS_OF_LIFE,
    onRun: onCheckSignsOfLife
});

/** shared */

Devvit.addTrigger({
    events: [ 'AppInstall', 'AppUpgrade' ],
    onEvent: onAppInstallAndUpgrade
});

export default Devvit;
