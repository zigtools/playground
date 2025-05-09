// Runs compiled Zig code

import { WASI, PreopenDirectory, OpenFile, File, ConsoleStdout } from "@bjorn3/browser_wasi_shim";

async function run(wasmData: Uint8Array) {
    let args = ["main.wasm"];
    let env = [];
    let fds = [
        new OpenFile(new File([])), // stdin
        ConsoleStdout.lineBuffered((line) => postMessage({ stderr: line })), // stdout
        ConsoleStdout.lineBuffered((line) => postMessage({ stderr: line })), // stderr
        new PreopenDirectory(".", new Map([])),
    ];
    let wasi = new WASI(args, env, fds);

    let { instance } = await WebAssembly.instantiate(wasmData, {
        "wasi_snapshot_preview1": wasi.wasiImport,
    });;

    try {
        // @ts-ignore
        const exitCode = wasi.start(instance);

        postMessage({
            stderr: `\n\n---\nexit with exit code ${exitCode}\n---\n`,
        });
    } catch (err) {
        postMessage({ stderr: `${err}` });
    }

    postMessage({
        done: true,
    });
}

onmessage = (event) => {
    if (event.data.run) {
        run(event.data.run);
    }
}
