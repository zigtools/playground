// Runs compiled Zig code

import { WASI, PreopenDirectory, OpenFile, File } from "@bjorn3/browser_wasi_shim";
import { stderrOutput } from "../utils";

async function run(wasmData: BufferSource) {
    const args = ["main.wasm"];
    const env: string[] = [];
    const fds = [
        new OpenFile(new File([])), // stdin
        stderrOutput(), // stdout
        stderrOutput(), // stderr
        new PreopenDirectory(".", new Map([])),
    ];
    const wasi = new WASI(args, env, fds);

    const { instance } = await WebAssembly.instantiate(wasmData, {
        "wasi_snapshot_preview1": wasi.wasiImport,
    });;

    let exitCode = 0;
    try {
        // @ts-ignore
        exitCode = wasi.start(instance);
    } catch (err) {
        postMessage({ stderr: `${err}` });
        exitCode = 1;
    }

    postMessage({
        done: true,
        exitCode,
    });
}

onmessage = (event) => {
    if (event.data.run) {
        run(event.data.run);
    }
}
