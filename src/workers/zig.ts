import { WASI, PreopenDirectory, Fd, File, ConsoleStdout, OpenFile, Inode } from "@bjorn3/browser_wasi_shim";
import { getLatestZigArchive } from "../utils";
// @ts-ignore
import zlsWasm from "url:../zig_release.wasm";

let currentlyRunning = false;
async function run(source: string) {
    if (currentlyRunning) return;

    currentlyRunning = true;

    const libDirectory = await getLatestZigArchive();

    // -fno-llvm -fno-lld is set explicitly to ensure the native WASM backend is
    // used in preference to LLVM. This may be removable once the non-LLVM
    // backends become more mature.
    let args = ["zig.wasm", "build-exe", "main.zig", "-Dtarget=wasm32-wasi", "-fno-llvm", "-fno-lld"];
    let env = [];
    let fds = [
        new OpenFile(new File([])), // stdin
        ConsoleStdout.lineBuffered((line) => postMessage({ stderr: line })), // stdout
        ConsoleStdout.lineBuffered((line) => postMessage({ stderr: line })), // stderr
        new PreopenDirectory(".", new Map<string, Inode>([
            ["main.zig", new File(new TextEncoder().encode(source))],
        ])),
        new PreopenDirectory("/lib", libDirectory.contents),
        new PreopenDirectory("/cache", new Map()),
    ] satisfies Fd[];
    let wasi = new WASI(args, env, fds, { debug: false });

    postMessage({
        stderr: "Creating WebAssembly instance...",
    });

    const { instance } = await WebAssembly.instantiateStreaming(fetch(zlsWasm), {
        "wasi_snapshot_preview1": wasi.wasiImport,
    });

    postMessage({
        stderr: "Compiling...",
    });

    try {
        // @ts-ignore
        const exitCode = wasi.start(instance);

        if (exitCode == 0) {
            const cwd = wasi.fds[3] as PreopenDirectory;
            const mainWasm = cwd.dir.contents.get("main.wasm") as File | undefined;
            if (mainWasm) {
                postMessage({ compiled: mainWasm.data });
            }
        }
    } catch (err) {
        postMessage({
            stderr: `${err}`,
        });
    }

    currentlyRunning = false;
}

onmessage = (event) => {
    if (event.data.run) {
        run(event.data.run);
    }
}
