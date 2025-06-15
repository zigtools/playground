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
    const outputs = document.getElementById("output")!;
    outputs.scrollTo(0, outputs.scrollHeight!);
}

let zigWorker = new ZigWorker();

zigWorker.onmessage = ev => {
    if (ev.data.stderr) {
        document.querySelector(".zig-output:last-child")!.textContent += ev.data.stderr;
        scrollOutputToEnd();
        return;
    } else if (ev.data.failed) {
        const outputSplit = document.createElement("div");
        outputSplit.classList.add("output-split");
        document.getElementById("output")!.appendChild(outputSplit);
    } else if (ev.data.compiled) {
        let runnerWorker = new RunnerWorker();

        const zigOutput = document.createElement("div");
        zigOutput.classList.add("runner-output");
        zigOutput.classList.add("latest");
        document.getElementById("output")!.appendChild(zigOutput);
        
        runnerWorker.postMessage({run: ev.data.compiled});

        runnerWorker.onmessage = rev => {
            if (rev.data.stderr) {
                document.querySelector(".runner-output:last-child")!.textContent += rev.data.stderr;
                scrollOutputToEnd();
                return;
            } else if (rev.data.done) {
                runnerWorker.terminate();
                const outputSplit = document.createElement("div");
                outputSplit.classList.add("output-split");
                document.getElementById("output")!.appendChild(outputSplit);
            }
        }
    }
}

const splitPane = document.getElementById("split-pane")! as HTMLDivElement;
const resizeBar = document.getElementById("resize-bar")! as HTMLDivElement;

function clamp(value, min, max) {
    if (value < min) {
        return min;
    } else if (value > max) {
        return max;
    } else {
        return value;
    }
}

let resizing = false;
resizeBar.addEventListener("mousedown", event => {
    if (event.buttons & 1) {
        resizing = true;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "row-resize";
    }
});
window.addEventListener("mousemove", event => {
    if (resizing) {
        const percent = clamp(event.clientY / window.innerHeight * 100, 40, 100);
        splitPane.style.setProperty("--editor-height-percent", `${percent}%`);
    }
});
window.addEventListener("mouseup", event => {
    resizing = false;
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");
});

const outputsRun = document.getElementById("run")! as HTMLButtonElement;
outputsRun.addEventListener("click", async () => {
    for (const zo of document.querySelectorAll(".zig-output")) {
        zo.classList.remove("latest");
    }
    for (const ro of document.querySelectorAll(".runner-output")) {
        ro.classList.remove("latest");
    }

    const zigOutput = document.createElement("div");
    zigOutput.classList.add("zig-output");
    zigOutput.classList.add("latest");
    document.getElementById("output")!.appendChild(zigOutput);

    zigWorker.postMessage({
        run: (await editor).state.doc.toString(),
    });
});
