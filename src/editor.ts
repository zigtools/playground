import { EditorState } from "@codemirror/state"
import { gutter, lineNumbers } from "@codemirror/view"
import { EditorView, minimalSetup } from "codemirror"
import { languageServerWithTransport } from "codemirror-languageserver";

import { Transport } from "@open-rpc/client-js/build/transports/Transport";
import { getNotifications } from "@open-rpc/client-js/src/Request";
import type { JSONRPCRequestData, IJSONRPCData } from "@open-rpc/client-js/src/Request";
import { Sharer } from "./sharer";

export default class PostMessageWorkerTransport extends Transport {
    public worker: Worker;
    public postMessageID: string;
    public sharer: Sharer;

    constructor(worker: Worker) {
        super();
        this.worker = worker;
        this.postMessageID = `post-message-transport-${Math.random()}`;
        this.sharer = Sharer.init();
    }

    private messageHandler = (ev: MessageEvent) => {
        console.log("LSP <<-", ev.data);
        this.transportRequestManager.resolveResponse(JSON.stringify(ev.data));
    };

    public connect(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            this.worker.addEventListener("message", this.messageHandler);
            this.worker.postMessage({
                indexBuffer: this.sharer.indexBuffer,
                lockBuffer: this.sharer.lockBuffer,
                stdinBlockBuffer: this.sharer.stdinBlockBuffer,
                dataBuffer: this.sharer.dataBuffer,
            });
            resolve();
        });
    }

    public async sendData(data: JSONRPCRequestData, timeout: number | null = 5000): Promise<any> {
        console.log("LSP ->>", data);
        const prom = this.transportRequestManager.addRequest(data, null);
        const notifications = getNotifications(data);
        if (this.worker) {
            const req = (data as IJSONRPCData).request;
                const str = JSON.stringify(req);

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
            Atomics.notify(new Int32Array(transport.sharer.stdinBlockBuffer), 0);

            this.transportRequestManager.settlePendingRequest(notifications);
        }
        return prom;
    }

    public close(): void {
        this.worker.terminate();
    }
}

let transport = new PostMessageWorkerTransport(new Worker(
    new URL("worker.ts", import.meta.url),
    {type: "module"}
));

const ls = languageServerWithTransport({
    transport,
    rootUri: "file:///",
    workspaceFolders: null,
    documentUri: `file:///main.zig`,
    languageId: "zig",
});

let editor = new EditorView({
    extensions: [minimalSetup, lineNumbers(), gutter({})],
    parent: document.getElementById("editor")!,
    state: EditorState.create({
        extensions: [ls],
    }),
});

// document.body.addEventListener("click", () => {
//     Atomics.store(new Int32Array(transport.sharer.stdinBlockBuffer), 0, 1);
//     Atomics.notify(new Int32Array(transport.sharer.stdinBlockBuffer), 0);
// });
