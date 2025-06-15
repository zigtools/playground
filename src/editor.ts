import { EditorState } from "@codemirror/state"
import { keymap } from "@codemirror/view"
import { EditorView, basicSetup } from "codemirror"
import { JsonRpcMessage, LspClient } from "./lsp";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
// @ts-ignore
import ZLSWorker from './workers/zls.ts?worker';
// @ts-ignore
import ZigWorker from './workers/zig.ts?worker';
// @ts-ignore
import RunnerWorker from './workers/runner.ts?worker';

export default class ZlsClient extends LspClient {
    public worker: Worker;

    constructor(worker: Worker) {
        super("file:///", []);
        this.worker = worker;

        this.worker.addEventListener("message", this.messageHandler);
    }

    private messageHandler = (ev: MessageEvent) => {
        const data = JSON.parse(ev.data);

        if (data.method == "window/logMessage" || data.stderr) {
            let logLevel = "[?????] ";
            let color = "white";
            if (!data.stderr) {
                switch (data.params.type) {
                    case 5:
                        logLevel = "[DEBUG] ";
                        color = "white";
                        break;
                    case 4:
                        logLevel = "[LOG  ] ";
                        color = "paleturquoise";
                        break;
                    case 3:
                        logLevel = "[INFO ] ";
                        color = "lightblue";
                        break;
                    case 2:
                        logLevel = "[WARN ] ";
                        color = "darkorange";
                        break;
                    case 1:
                        logLevel = "[ERROR] ";
                        color = "crimson";
                        break;
                    default:
                        break;
                }
            }

            const line = document.createElement('div');
            line.style.color = color;

            const logLevelSpan = document.createElement('span');
            logLevelSpan.textContent = logLevel;

            const logTextSpan = document.createElement('span');
            logTextSpan.textContent = data.stderr ? data.stderr : data.params.message;

            line.appendChild(logLevelSpan);
            line.appendChild(logTextSpan);

            document.getElementById("zls-stderr")?.append(line);
            scrollOutputToEnd();
        } else {
            console.debug("LSP <<-", data);
        }
        this.handleMessage(data);
    };

    public async sendMessage(message: JsonRpcMessage): Promise<void> {
        console.debug("LSP ->>", message);
        if (this.worker) {
            this.worker.postMessage(JSON.stringify(message));
        }
    }

    public async close(): Promise<void> {
        super.close();
        this.worker.terminate();
    }
}

let client = new ZlsClient(new ZLSWorker());

let editor = (async () => {
    await client.initialize();

    let editor = new EditorView({
        extensions: [],
        parent: document.getElementById("editor")!,
        state: EditorState.create({
            doc: `const std = @import("std");

pub fn main() !void {
    std.debug.print("All your {s} are belong to us.\\n", .{"codebase"});

    try std.io.getStdOut().writer().writeAll("bruh");
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
    const outputs = document.getElementById("outputs-tabs")!;
    outputs.scrollTo(0, outputs.scrollHeight!);
}

function changeTab(newTab: string) {
    for (const old of document.querySelectorAll("#outputs-tabs>*")) old.classList.remove("shown");
    document.getElementById(newTab)?.classList.add("shown");
    scrollOutputToEnd();
}

let zigWorker = new ZigWorker();

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

        let runnerWorker = new RunnerWorker();
        
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

const outputs_tab_selector = document.getElementById("outputs-tab")! as HTMLSelectElement;

outputs_tab_selector.addEventListener("change", () => {
    changeTab(outputs_tab_selector.value);
});

const outputs_run = document.getElementById("outputs-run")! as HTMLButtonElement;

outputs_run.addEventListener("click", async () => {
    document.getElementById("zig-stderr")!.innerHTML = "";
    document.getElementById("zig-output")!.innerHTML = "";

    zigWorker.postMessage({
        run: (await editor).state.doc.toString(),
    });

    outputs_tab_selector.value = "zig-stderr";
    changeTab("zig-stderr");
});
