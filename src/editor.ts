import { lspClient, PlaygroundWorkspace } from "./lsp.ts";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { ImageAddon } from "@xterm/addon-image";
import "@xterm/xterm/css/xterm.css";
// @ts-ignore
import ZigWorker from './workers/zig.ts?worker';
// @ts-ignore
import RunnerWorker from './workers/runner.ts?worker';
// @ts-ignore
import helloWorldSource from './examples/hello-world.zig?raw';
// @ts-ignore
import ansiTextSource from './examples/ansi-text.zig?raw';
// @ts-ignore
import fizzBuzzSource from './examples/fizz-buzz.zig?raw';
// @ts-ignore
import fibonacciSource from './examples/fibonacci.zig?raw';
// @ts-ignore
import mandelbrotSource from './examples/mandelbrot.zig?raw';
// @ts-ignore
import kittyImageSource from './examples/kitty-image.zig?raw';

(lspClient.workspace as PlaygroundWorkspace).createAndOpenUnnamedFile(helloWorldSource);

const output = document.getElementById("output")!;
const executionStatus = document.getElementById("execution-status")!;
const outputStyle = getComputedStyle(document.documentElement);
const terminal = new Terminal({
    disableStdin: true,
    convertEol: true,
    cursorBlink: false,
    fontSize: 16,
    fontFamily: "monospace",
    scrollback: 1000,
    theme: {
        background: outputStyle.getPropertyValue("--output-background").trim(),
        foreground: outputStyle.getPropertyValue("--output-text").trim(),
    },
});
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.loadAddon(new ImageAddon());
terminal.open(output);
terminal.write("\x1b[?25l"); // hide cursor
fitAddon.fit();
new ResizeObserver(() => fitAddon.fit()).observe(output);

function revealOutputWindow() {
    const editorWidthPercent = parseFloat(splitPane.style.getPropertyValue("--editor-width-percent"));
    if (editorWidthPercent == 100) {
        splitPane.style.setProperty("--editor-width-percent", `${resizeBarPreviousSize}%`);
    }
}

let zigWorker = new ZigWorker();
let compilationStartedAt = 0;
let isCompiling = false;
let executionId = 0;

zigWorker.onmessage = (ev: MessageEvent) => {
    if (ev.data.stderr) {
        terminal.write(ev.data.stderr);
        revealOutputWindow();
        return;
    } else if (ev.data.compiled) {
        const compilationTime = Math.round(performance.now() - compilationStartedAt);
        const currentExecutionId = executionId;
        const runStartedAt = performance.now();
        isCompiling = false;
        executionStatus.textContent = `Compiled in ${compilationTime} ms | Running...`;

        let runnerWorker = new RunnerWorker();

        runnerWorker.postMessage({ run: ev.data.compiled });

        runnerWorker.onmessage = (rev: MessageEvent) => {
            if (rev.data.stderr) {
                terminal.write(rev.data.stderr);
                revealOutputWindow();
                return;
            } else if (rev.data.done) {
                if (currentExecutionId == executionId) {
                    const runTime = Math.round(performance.now() - runStartedAt);
                    executionStatus.textContent = `Compiled in ${compilationTime} ms | Ran in ${runTime} ms | Exit code ${rev.data.exitCode}`;
                }
                runnerWorker.terminate();
            }
        }
    } else if (ev.data.failed) {
        const compilationTime = Math.round(performance.now() - compilationStartedAt);
        isCompiling = false;
        executionStatus.textContent = `Compilation failed in ${compilationTime} ms`;
    }
}

const splitPane = document.getElementById("split-pane")! as HTMLDivElement;
const resizeBar = document.getElementById("resize-bar")! as HTMLDivElement;
let resizeBarPreviousSize = 60;

function onResizeBarMove(event: MouseEvent) {
    const bounds = splitPane.getBoundingClientRect();
    const percent = Math.min(Math.max(10, (event.clientX - bounds.left) / bounds.width * 100), 100);
    splitPane.style.setProperty("--editor-width-percent", `${percent}%`);
}
function onResizeBarMouseUp(event: MouseEvent) {
    window.removeEventListener("mousemove", onResizeBarMove);
    window.removeEventListener("mouseup", onResizeBarMouseUp);

    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");

    // fully close the output window when it's almost closed
    const editorWidthPercent = parseFloat(splitPane.style.getPropertyValue("--editor-width-percent"));
    if (editorWidthPercent >= 90) {
        splitPane.style.setProperty("--editor-width-percent", "100%");
    }
}

resizeBar.addEventListener("mousedown", event => {
    if (event.buttons & 1) {
        window.addEventListener("mousemove", onResizeBarMove);
        window.addEventListener("mouseup", onResizeBarMouseUp);
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
    }
});
resizeBar.addEventListener("dblclick", event => {
    const editorWidthPercent = parseFloat(splitPane.style.getPropertyValue("--editor-width-percent"));
    if (editorWidthPercent == 100) {
        splitPane.style.setProperty("--editor-width-percent", `${resizeBarPreviousSize}%`);
    } else {
        resizeBarPreviousSize = editorWidthPercent;
        splitPane.style.setProperty("--editor-width-percent", `100%`);
    }
});

const outputsRun = document.getElementById("run")! as HTMLButtonElement;
const exampleSelect = document.getElementById("example-select")! as HTMLSelectElement;

const examples: Record<string, string> = {
    "hello-world": helloWorldSource,
    "ansi-text": ansiTextSource,
    "fizz-buzz": fizzBuzzSource,
    "fibonacci": fibonacciSource,
    "mandelbrot": mandelbrotSource,
    "kitty-image": kittyImageSource,
};

exampleSelect.addEventListener("change", () => {
    editor.dispatch({
        changes: {
            from: 0,
            to: editor.state.doc.length,
            insert: examples[exampleSelect.value],
        },
    });
});

outputsRun.addEventListener("click", async () => {
    if (isCompiling) return;

    isCompiling = true;
    executionId += 1;
    compilationStartedAt = performance.now();
    executionStatus.textContent = "Compiling...";
    terminal.reset();
    terminal.write("\x1b[?25l"); // hide cursor
    revealOutputWindow();

    // TODO
    // zigWorker.postMessage({
    //     run: editor.state.doc.toString(),
    // });
});
