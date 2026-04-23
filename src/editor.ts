import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { EditorView, basicSetup } from "codemirror";
import { formatDocument } from "@codemirror/lsp-client";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit, syntaxHighlighting } from "@codemirror/language";
import { zigLanguage } from "@ndim/codemirror-lang-zig";
import { editorTheme, highlightStyle } from "./theme.ts";
import { lspClient } from "./lsp.ts";
// @ts-ignore
import ZigWorker from './workers/zig.ts?worker';
// @ts-ignore
import RunnerWorker from './workers/runner.ts?worker';
// @ts-ignore
import zigMainSource from './main.zig?raw';

const editor = new EditorView({
  extensions: [],
  parent: document.getElementById("editor")!,
  state: EditorState.create({
    doc: zigMainSource,
    extensions: [
      basicSetup,
      editorTheme,
      indentUnit.of("    "),
      keymap.of([
        indentWithTab,
        {
          key: "Mod-s",
          run: formatDocument,
        },
      ]),
      zigLanguage,
      syntaxHighlighting(highlightStyle),
      lspClient.plugin("file:///main.zig"),
    ],
  }),
});

function revealOutputWindow() {
    const outputs = document.getElementById("output")!;
    outputs.scrollTo(0, outputs.scrollHeight!);
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

    zigWorker.postMessage({
        run: editor.state.doc.toString(),
    });
});
