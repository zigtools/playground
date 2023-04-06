import { EditorState } from "@codemirror/state"
import { keymap } from "@codemirror/view"
import { EditorView, basicSetup, minimalSetup } from "codemirror"
import { JsonRpcMessage, LspClient } from "./lsp";
import { Sharer } from "./sharer";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";

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

        // Atomics mess up debug functionality, so this unfreezes
        // the service worker when you want to inspect a logged object
        window.unfreeze = () => {
            Atomics.store(new Int32Array(this.sharer.stdinBlockBuffer), 0, 1);
            Atomics.notify(new Int32Array(this.sharer.stdinBlockBuffer), 0);
        }
    }

    private messageHandler = (ev: MessageEvent) => {
        if (ev.data.stderr) {
            const line = document.createElement("div");
            line.innerText = ev.data.stderr;
            document.getElementById("zls-stderr")?.append(line);
            scrollOutputToEnd();
            return;
        }

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
    new URL("workers/zls.ts", import.meta.url),
    {type: "module"}
));

let editor = (async () => {
    await client.initialize();

    let editor = new EditorView({
        extensions: [],
        parent: document.getElementById("editor")!,
        state: EditorState.create({
            doc:
`const std = @import("std");

pub fn main() u8 {
    std.debug.print("All your {s} are belong to us.\\n", .{"codebase"});

    // WASI mains don't support errors (we can fix this with a horrible
    // wrapper hack in the future :P)
    std.io.getStdOut().writer().writeAll("bruh") catch return 1;

    return 0;
}
`,
            extensions: [basicSetup, oneDark, indentUnit.of("    "), client.createPlugin("file:///main.zig", "zig", true), keymap.of([indentWithTab]),],
        }),
    });

    await client.plugins[0].updateDecorations();
    await client.plugins[0].updateFoldingRanges();
    editor.update([]);

    return editor;
})();

function scrollOutputToEnd() {
    const outputs = document.getElementById("outputs__tabs")!;
    outputs.scrollTo(0, outputs.scrollHeight!);
}

function changeTab(newTab) {
    for (const old of document.querySelectorAll("#outputs__tabs>*")) old.classList.remove("shown");
    document.getElementById(newTab)?.classList.add("shown");
    scrollOutputToEnd();
}

let zigWorker = new Worker(
    new URL("workers/zig.ts", import.meta.url),
    {type: "module"}
);

zigWorker.onmessage = ev => {
    if (ev.data.stderr) {
        const line = document.createElement("div");
        line.innerText = ev.data.stderr;
        document.getElementById("zig-stderr")?.append(line);
        scrollOutputToEnd();
        return;
    } else if (ev.data.compiled) {
        outputs_tab_selector.value = "zig-output";
        changeTab("zig-output");

        let runnerWorker = new Worker(
            new URL("workers/runner.ts", import.meta.url),
            {type: "module"}
        );
        
        runnerWorker.postMessage({run: ev.data.compiled});

        runnerWorker.onmessage = rev => {
            if (rev.data.stderr) {
                document.getElementById("zig-output")!.innerHTML += rev.data.stderr;
                scrollOutputToEnd();
                return;
            } else if (rev.data.done) {
                runnerWorker.terminate();
            }
        }
    }
}

const outputs_tab_selector = document.getElementById("outputs__tab")! as HTMLSelectElement;

outputs_tab_selector.addEventListener("change", () => {
    changeTab(outputs_tab_selector.value);
});

const outputs_run = document.getElementById("outputs__run")! as HTMLButtonElement;

outputs_run.addEventListener("click", async () => {
    zigWorker.postMessage({
        run: (await editor).state.doc.toString(),
    });

    outputs_tab_selector.value = "zig-stderr";
    changeTab("zig-stderr");
});
