// Runs compiled Zig code

import { WASI, Directory, PreopenDirectory, Fd, File, OpenDirectory } from "../wasi";
import { Iovec } from "../wasi/wasi_defs";
// @ts-ignore
import zlsWasm from "url:../zig_release.wasm";
// @ts-ignore
import { getLatestZigArchive } from "../utils";

enum StdioKind {
    stdin = "stdin",
    stdout = "stdout",
    stderr = "stderr",
}

class Stdio extends Fd {
    kind: StdioKind;
    buffer: number[];

    constructor(kind: StdioKind) {
        super();
        this.kind = kind;
    }

    fd_write(view8: Uint8Array, iovs: Iovec[]): { ret: number; nwritten: number; } {
        let nwritten = 0;
        for (let iovec of iovs) {
            const slice = view8.slice(iovec.buf, iovec.buf + iovec.buf_len);

            postMessage({
                // [this.kind]
                stderr: new TextDecoder("utf-8").decode(slice),
            });

            nwritten += iovec.buf_len;
        }
        return { ret: 0, nwritten };
    }

    fd_read(view8: Uint8Array, iovs: Iovec[]): { ret: number; nread: number; } {
        console.error("Zig shoudln't be reading from stdin!");

        return { ret: 0, nread: 0 };
    }
}

const stdin = new Stdio(StdioKind.stdin);

async function run(wasmData: Uint8Array) {
    let wasm = await WebAssembly.compile(wasmData);

    let args = ["main.wasm"];
    let env = [];
    let fds = [
        stdin, // stdin
        new Stdio(StdioKind.stdout), // stdout
        new Stdio(StdioKind.stderr), // stderr
        new PreopenDirectory(".", {
            "main.wasm": new File(wasmData),
        }),
    ];
    let wasi = new WASI(args, env, fds);

    let inst = await WebAssembly.instantiate(wasm, {
        "wasi_snapshot_preview1": wasi.wasiImport,
    });  

    try {
        wasi.start(inst);
    } catch (err) {
        postMessage({
            stderr: `\n\n---\n${err}\n---\n`,
        });
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

