import { WASI, PreopenDirectory, Fd, ConsoleStdout, Directory } from "@bjorn3/browser_wasi_shim";
import { getLatestZigArchive } from "../utils";
import { Sharer } from "../sharer";
// @ts-ignore
import zlsWasm from "../zls.wasm?url&inline";

let sharer: Sharer = new Sharer();

enum StdioKind {
    stdin = "stdin",
    stdout = "stdout",
}

class Stdio extends Fd {
    kind: StdioKind;
    buffer: number[];

    constructor(kind: StdioKind) {
        super();
        this.kind = kind;
        this.buffer = [];
    }

    fd_write(slice: Uint8Array): { ret: number; nwritten: number } {
        if (this.kind != StdioKind.stdout) throw new Error("Cannot write to stdin");

        this.buffer = this.buffer.concat(Array.from(slice));
        while (true) {
            const data = new TextDecoder("utf-8").decode(Uint8Array.from(this.buffer));

            if (!data.startsWith("Content-Length: ")) break;

            const len = parseInt(data.slice("Content-Length: ".length));
            const bodyStart = data.indexOf("\r\n\r\n") + 4;

            if (bodyStart === -1) break;
            if (this.buffer.length < bodyStart + len) break;

            this.buffer.splice(0, bodyStart + len);
            postMessage(JSON.parse(data.slice(bodyStart, bodyStart + len)));
        }
        return { ret: 0, nwritten: slice.length };
    }

    fd_read(size: number): { ret: number; data: Uint8Array; } {
        if (this.kind != StdioKind.stdin) throw new Error("Cannot read from non-stdin");

        if (sharer.index === 0) {
            Atomics.store(new Int32Array(sharer.stdinBlockBuffer), 0, 0);
            Atomics.wait(new Int32Array(sharer.stdinBlockBuffer), 0, 0);
        }

        sharer.lock();

        const read = Math.min(size, sharer.index);
        const data = new Uint8Array(sharer.dataBuffer).slice(0, read);

        new Uint8Array(sharer.dataBuffer).set(new Uint8Array(sharer.dataBuffer, read), 0);
        sharer.index -= read;

        sharer.unlock();

        return { ret: 0, data };
    }
}

onmessage = (event) => {
    sharer.indexBuffer = event.data.indexBuffer;
    sharer.lockBuffer = event.data.lockBuffer;
    sharer.stdinBlockBuffer = event.data.stdinBlockBuffer;
    sharer.dataBuffer = event.data.dataBuffer;
};

(async () => {
    let libDirectory = await getLatestZigArchive();

    let args = ["zls.wasm"];
    let env = [];
    let fds = [
        new Stdio(StdioKind.stdin), // stdin
        new Stdio(StdioKind.stdout), // stdout
        ConsoleStdout.lineBuffered((line) => postMessage({ stderr: line })), // stderr
        new PreopenDirectory(".", new Map([])),
        new PreopenDirectory("/lib", libDirectory.contents),
        new PreopenDirectory("/cache", new Map()),
    ];
    let wasi = new WASI(args, env, fds, { debug: false });

    const { instance } = await WebAssembly.instantiateStreaming(fetch(zlsWasm), {
        "wasi_snapshot_preview1": wasi.wasiImport,
    });

    // @ts-ignore
    wasi.start(instance);
})();
