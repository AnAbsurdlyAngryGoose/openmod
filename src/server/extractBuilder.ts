import { RichTextBuilder, TriggerContext } from "@devvit/public-api";
import { ModActionMessage } from "../protocol.js";

export class ExtractBuilder {
    private _modActionContext: ModActionContext;
    private _triggerContext: TriggerContext;
    private _richTextBuilder: RichTextBuilder;

    constructor(triggerContext: TriggerContext) {
        this._triggerContext = triggerContext;
        this._richTextBuilder = new RichTextBuilder();
    }

    async withContext(modActionMessage: ModActionMessage): Promise<ExtractBuilder> {
        return this;
    }

    async addHeader(): Promise<ExtractBuilder> {
        return this;
    }

    async addOriginalSubmission(): Promise<ExtractBuilder> {
        return this;
    }

    withFooter(): ExtractBuilder {
        return this;
    }

    get title() {
        return 'todo';
    }

    get text() {
        return this._richTextBuilder.build();
    }
};
