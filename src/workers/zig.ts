import { WASI, PreopenDirectory, Fd, File, OpenFile, Inode } from "@bjorn3/browser_wasi_shim";
import { getLatestZigArchive, stderrOutput } from "../utils";

let currentlyRunning = false;
async function run(source: string) {
    if (currentlyRunning) return;

    currentlyRunning = true;

    const libDirectory = await getLatestZigArchive();
    const compilerRtObject = await fetch(new URL("../../zig-out/compiler_rt.o", import.meta.url));

    const args = [
        "zig.wasm",
        "build-exe",
        "main.zig",
        "compiler_rt.o",
        "-fno-compiler-rt", // manually linked because the self hosted webassembly backend cannot compile it by itself
        "-fno-ubsan-rt",
    ];
    const env: string[] = [];
    const fds = [
        new OpenFile(new File([])), // stdin
        stderrOutput(), // stdout
        stderrOutput(), // stderr
        new PreopenDirectory(".", new Map<string, Inode>([
            ["main.zig", new File(new TextEncoder().encode(source))],
            ["compiler_rt.o", new File(await compilerRtObject.arrayBuffer())]
        ])),
        new PreopenDirectory("/lib", libDirectory.contents),
        new PreopenDirectory("/cache", new Map()),
    ] satisfies Fd[];
    const wasi = new WASI(args, env, fds, { debug: false });

    const { instance } = await WebAssembly.instantiateStreaming(fetch(new URL("../../zig-out/bin/zig.wasm", import.meta.url)), {
        "wasi_snapshot_preview1": wasi.wasiImport,
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
        postMessage({ failed: true });
    }

    currentlyRunning = false;
}

onmessage = (event) => {
    if (event.data.run) {
        run(event.data.run);
    }
}
