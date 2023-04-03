import { EditorState } from "@codemirror/state"
import { gutter, keymap, lineNumbers } from "@codemirror/view"
import { EditorView, basicSetup, minimalSetup } from "codemirror"
import { JsonRpcMessage, LspClient } from "./lsp";
import { Sharer } from "./sharer";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";

export default class ZlsClient extends LspClient {
    public worker: Worker;
    public sharer: Sharer;

    constructor(worker: Worker) {
        super("file:///", []);
        this.worker = worker;
        this.sharer = Sharer.init();

        this.worker.addEventListener("message", this.messageHandler);
        this.worker.postMessage({
            indexBuffer: this.sharer.indexBuffer,
            lockBuffer: this.sharer.lockBuffer,
            stdinBlockBuffer: this.sharer.stdinBlockBuffer,
            dataBuffer: this.sharer.dataBuffer,
        });
    }

    private messageHandler = (ev: MessageEvent) => {
        console.log("LSP <<-", ev.data);
        this.handleMessage(ev.data);
    };

    public async sendMessage(message: JsonRpcMessage): Promise<void> {
        console.log("LSP ->>", message);
        if (this.worker) {
            const str = JSON.stringify(message);

    const final =
`Content-Length: ${str.length}\r
\r
${str}`

            this.sharer.lock();

            const encoded = new TextEncoder().encode(final);
            new Uint8Array(this.sharer.dataBuffer).set(encoded, this.sharer.index);
            this.sharer.index += encoded.byteLength;

            console.log(this.sharer.index);

            this.sharer.unlock();

            Atomics.store(new Int32Array(this.sharer.stdinBlockBuffer), 0, 1);
            Atomics.notify(new Int32Array(this.sharer.stdinBlockBuffer), 0);
        }
    }

    public async close(): Promise<void> {
        super.close();
        this.worker.terminate();
    }
}

let client = new ZlsClient(new Worker(
    new URL("worker.ts", import.meta.url),
    {type: "module"}
));

(async () => {
    await client.initialize();

    let editor = new EditorView({
        extensions: [],
        parent: document.getElementById("editor")!,
        state: EditorState.create({
            extensions: [basicSetup, indentUnit.of("    "), client.createPlugin("file:///main.zig", "zig", true), keymap.of([indentWithTab]),],
        }),
    });
})();
