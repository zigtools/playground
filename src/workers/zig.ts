import { Sharer } from "../sharer";
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
        this.buffer = [];
    }

    fd_write(view8: Uint8Array, iovs: Iovec[]): { ret: number; nwritten: number; } {
        let nwritten = 0;
        for (let iovec of iovs) {
            const slice = view8.slice(iovec.buf, iovec.buf + iovec.buf_len);

            this.buffer.push(...slice);

            while (this.buffer.indexOf(10) !== -1) {
                let data = new TextDecoder("utf-8").decode(Uint8Array.from(this.buffer.splice(0, this.buffer.indexOf(10) + 1)));
                postMessage({
                    stderr: data,
                });
            }

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

const wasmData = (async () => {
    let libStd = await getLatestZigArchive();

    const wasmResp = await fetch(zlsWasm);
    const wasmData = await wasmResp.arrayBuffer();

    let args = ["zig.wasm", "build-exe", "main.zig", "-Dtarget=wasm32-wasi"];
    let env = [];
    let fds = [
        stdin, // stdin
        new Stdio(StdioKind.stdout), // stdout
        new Stdio(StdioKind.stderr), // stderr
        new PreopenDirectory(".", {
            "zig.wasm": new File(wasmData),
            "main.zig": new File(new TextEncoder().encode(
`const std = @import("std");

pub fn main() void {
    std.log.info("I just compiled this code in the browser!", .{});
}`
            )),
        }),
        new PreopenDirectory("/lib", {
            "std": libStd,
        }),
        new PreopenDirectory("/cache", {
            
        }),
    ];
    let wasi = new WASI(args, env, fds);

    let wasm = await WebAssembly.compile(wasmData);
    
    return {
        wasi,
        wasm,
    };
})();

let currentlyRunning = false;
async function run(source: string) {
    if (currentlyRunning) return;

    currentlyRunning = true;
    const {wasm, wasi} = await wasmData;
    wasi.fds[3].dir.contents["main.zig"].data = new TextEncoder().encode(source);

    postMessage({
        stderr: "Creating WebAssembly instance...",
    });

    let inst = await WebAssembly.instantiate(wasm, {
        "wasi_snapshot_preview1": wasi.wasiImport,
    });  
    
    postMessage({
        stderr: "Compiling...",
    });

    try {
        wasi.start(inst);
    } catch (err) {
        postMessage({
            stderr: `${err}`,
        });
    }

    console.log(wasi.fds[3].dir.contents["main.wasm"]);
    // let blob = new Blob([wasi.fds[3].dir.contents["main.wasm"].data], {
    //     type: "application/octet-stream"
    //   });
    // console.log(URL.createObjectURL(blob));
    currentlyRunning = false;
}

onmessage = (event) => {
    if (event.data.run) {
        run(event.data.run);
    }
}
