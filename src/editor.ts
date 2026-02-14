import { EditorState } from "@codemirror/state"
import { keymap } from "@codemirror/view"
import { EditorView, basicSetup } from "codemirror"
import { JsonRpcMessage, LspClient } from "./lsp";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { editorTheme } from "./theme.ts";
// @ts-ignore
import ZLSWorker from './workers/zls.ts?worker';
// @ts-ignore
import ZigWorker from './workers/zig.ts?worker';
// @ts-ignore
import RunnerWorker from './workers/runner.ts?worker';
// @ts-ignore
import zigMainSource from './main.zig?raw';
// @ts-ignore
import zigModSource from './mod.zig?raw';

export default class ZlsClient extends LspClient {
    public worker: Worker;

    constructor(worker: Worker) {
        super("file:///", []);
        this.worker = worker;
        this.autoClose = false;

        this.worker.addEventListener("message", this.messageHandler);
    }

    private messageHandler = (ev: MessageEvent) => {
        const data = JSON.parse(ev.data);

        if (data.method == "window/logMessage") {
            if (!data.stderr) {
                switch (data.params.type) {
                    case 5:
                        console.debug("ZLS --- ", data.params.message);
                        break;
                    case 4:
                        console.log("ZLS --- ", data.params.message);
                        break;
                    case 3:
                        console.info("ZLS --- ", data.params.message);
                        break;
                    case 2:
                        console.warn("ZLS --- ", data.params.message);
                        break;
                    case 1:
                        console.error("ZLS --- ", data.params.message);
                        break;
                    default:
                        console.error(data.params.message);
                        break;
                }
            }
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

interface PlaygroundFile {
    name: string;
    state: EditorState;
}

let files: PlaygroundFile[] = [];
let activeFileIndex = -1;
let editorView: EditorView;

function createEditorState(filename: string, content: string) {
    return EditorState.create({
        doc: content,
        extensions: [
            basicSetup,
            editorTheme,
            indentUnit.of("    "),
            client.createPlugin(`file:///${filename}`, "zig", true),
            keymap.of([indentWithTab]),
        ],
    });
}

function updateTabs() {
    const tabsContainer = document.getElementById("tabs")!;
    tabsContainer.innerHTML = "";

    files.forEach((file, index) => {
        const tab = document.createElement("div");
        tab.className = `tab ${index === activeFileIndex ? "active" : ""}`;

        const nameSpan = document.createElement("span");
        nameSpan.className = "tab-name";
        nameSpan.textContent = file.name;
        tab.appendChild(nameSpan);

        if (file.name !== "main.zig") {
            const closeBtn = document.createElement("span");
            closeBtn.className = "tab-close";
            closeBtn.innerHTML = "&times;";
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                removeFile(index);
            };
            tab.appendChild(closeBtn);
        }

        tab.onclick = () => switchFile(index);
        tab.ondblclick = () => renameFile(index);

        tabsContainer.appendChild(tab);
    });
}

async function switchFile(index: number) {
    if (index === activeFileIndex) return;

    if (activeFileIndex !== -1 && editorView) {
        files[activeFileIndex].state = editorView.state;
    }

    activeFileIndex = index;
    const file = files[index];

    if (!editorView) {
        editorView = new EditorView({
            state: file.state,
            parent: document.getElementById("editor")!,
        });
    } else {
        editorView.setState(file.state);
    }

    updateTabs();
}

function addFile() {
    let name = "untitled.zig";
    let counter = 0;
    while (files.some(f => f.name === name)) {
        counter++;
        name = `untitled${counter}.zig`;
    }

    const newFile: PlaygroundFile = {
        name,
        state: createEditorState(name, ""),
    };
    files.push(newFile);
    switchFile(files.length - 1);
}

function removeFile(index: number) {
    if (files[index].name === "main.zig") return;

    files.splice(index, 1);
    if (activeFileIndex >= files.length) {
        activeFileIndex = files.length - 1;
    }
    switchFile(activeFileIndex);
    updateTabs();
}

function renameFile(index: number) {
    const file = files[index];
    const newName = prompt("Rename file:", file.name);
    if (newName && newName !== file.name && newName.endsWith(".zig")) {
        if (files.some(f => f.name === newName)) {
            alert("File already exists!");
            return;
        }

        const content = file.state.doc.toString();
        file.name = newName;
        file.state = createEditorState(newName, content);

        if (index === activeFileIndex) {
            editorView.setState(file.state);
        }
        updateTabs();
    }
}

(async () => {
    await client.initialize();

    files.push({
        name: "main.zig",
        state: createEditorState("main.zig", zigMainSource),
    });

    files.push({
        name: "mod.zig",
        state: createEditorState("mod.zig", zigModSource),
    });

    await switchFile(0);
})();

document.getElementById("add-file")?.addEventListener("click", addFile);

// Convert vertical mouse wheel to horizontal scroll on the tabs bar
const tabsEl = document.getElementById("tabs")!;
tabsEl.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        tabsEl.scrollLeft += e.deltaY;
    }
}, { passive: false });

// Show/hide right scroll shadow when tabs overflow
function updateTabsScrollShadow() {
    const hasOverflowRight = tabsEl.scrollLeft + tabsEl.clientWidth < tabsEl.scrollWidth - 1;
    tabsEl.classList.toggle("scroll-shadow-right", hasOverflowRight);
}
tabsEl.addEventListener("scroll", updateTabsScrollShadow);
new ResizeObserver(updateTabsScrollShadow).observe(tabsEl);
new MutationObserver(updateTabsScrollShadow).observe(tabsEl, { childList: true });

function revealOutputWindow() {
    const outputs = document.getElementById("output")!;
    outputs.scrollTo(0, outputs.scrollHeight!);
    const splitPane = document.getElementById("split-pane")!;
    const editorHeightPercent = parseFloat(splitPane.style.getPropertyValue("--editor-height-percent"));
    if (editorHeightPercent == 100) {
        splitPane.style.setProperty("--editor-height-percent", `${resizeBarPreviousSize}%`);
    }
}

let zigWorker = new ZigWorker();

zigWorker.onmessage = (ev: MessageEvent) => {
    if (ev.data.stderr) {
        document.querySelector(".zig-output:last-child")!.textContent += ev.data.stderr;
        revealOutputWindow();
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

        runnerWorker.postMessage({ run: ev.data.compiled });

        runnerWorker.onmessage = (rev: MessageEvent) => {
            if (rev.data.stderr) {
                document.querySelector(".runner-output:last-child")!.textContent += rev.data.stderr;
                revealOutputWindow();
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
let resizeBarPreviousSize = 70;

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
        const percent = Math.min(Math.max(10, event.clientY / splitPane.getBoundingClientRect().height * 100), 100);
        splitPane.style.setProperty("--editor-height-percent", `${percent}%`);
    }
});
window.addEventListener("mouseup", event => {
    resizing = false;
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");

    // fully close the output window when it's almost closed
    const editorHeightPercent = parseFloat(splitPane.style.getPropertyValue("--editor-height-percent"));
    if (editorHeightPercent >= 90) {
        splitPane.style.setProperty("--editor-height-percent", "100%");
    }
});
resizeBar.addEventListener("dblclick", event => {
    const editorHeightPercent = parseFloat(splitPane.style.getPropertyValue("--editor-height-percent"));
    if (editorHeightPercent == 100) {
        splitPane.style.setProperty("--editor-height-percent", `${resizeBarPreviousSize}%`);
    } else {
        resizeBarPreviousSize = editorHeightPercent;
        splitPane.style.setProperty("--editor-height-percent", `100%`);
    }
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
    revealOutputWindow();

    const filesToSend: { [filename: string]: string } = {};
    files.forEach((file, index) => {
        if (index === activeFileIndex && editorView) {
            filesToSend[file.name] = editorView.state.doc.toString();
        } else {
            filesToSend[file.name] = file.state.doc.toString();
        }
    });

    zigWorker.postMessage({
        files: filesToSend
    });
});
