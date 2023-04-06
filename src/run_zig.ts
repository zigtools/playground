import { Sharer } from "./sharer";
import { WASI, Directory, PreopenDirectory, Fd, File, OpenDirectory } from "./wasi";
// import { Directory, PreopenDirectory, Fd, File } from "wasi"
import { Iovec } from "@bjorn3/browser_wasi_shim/typings/wasi_defs";
import { untar } from "@immutabl3/tar";
// @ts-ignore
import zlsWasm from "url:./zig_release.wasm";
// @ts-ignore
import zigTar from "url:./zig.tar.gz";
import { ungzip } from "pako";

let sharer: Sharer = new Sharer();

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

        return { ret: 0, nread };
    }
}

const stdin = new Stdio(StdioKind.stdin);

async function getLatestZigArchive() {
    const archive = await (await fetch(zigTar, {})).arrayBuffer();
    const entries = await untar(ungzip(archive));

    const first = entries[0].path;

    let dirs = new Directory({});

    for (const e of entries) {
        if (e.type === "file") {
            const path = e.path.slice(first.length);
            const splitPath = path.split("/");

            let c = dirs;
            for (const segment of splitPath.slice(0, -1)) {
                c.contents[segment] = c.contents[segment] ?? new Directory({});
                c = c.contents[segment];
            }

            c.contents[splitPath[splitPath.length - 1]] = new File(e.getBinary())
        }
    }

    return dirs;
}

(async () => {
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
    let inst = await WebAssembly.instantiate(wasm, {
        "wasi_snapshot_preview1": wasi.wasiImport,
    });  
    try {
        wasi.start(inst);
    } catch (err) {
        console.error(err);
    }

    console.log(fds[3].dir.contents["main.wasm"]);
    let blob = new Blob([fds[3].dir.contents["main.wasm"].data], {
        type: "application/octet-stream"
      });
    console.log(URL.createObjectURL(blob));
})();
