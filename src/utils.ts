// @ts-ignore
import zigTarGz from "./zig.tar.gz?inline";
import { untar } from "@andrewbranch/untar.js";
import { Directory, File } from "@bjorn3/browser_wasi_shim";

export async function getLatestZigArchive() {
    const ds = new DecompressionStream("gzip");
    const zigTarResponse = new Response((await fetch(zigTarGz)).body?.pipeThrough(ds));
    const entries = await untar(await zigTarResponse.arrayBuffer());

    let root: TreeNode = new Map();

    for (const e of entries) {
        if (!e.filename.startsWith("lib/")) continue;
        const path = e.filename.slice("lib/".length);
        const splitPath = path.split("/");

        let c = root;
        for (const segment of splitPath.slice(0, -1)) {
            if (!c.has(segment)) {
                c.set(segment, new Map());
            }
            c = c.get(segment) as TreeNode;
        }


        c.set(splitPath[splitPath.length - 1], e.fileData);
    }

    return convert(root);
}

type TreeNode = Map<string, TreeNode | Uint8Array>;

function convert(node: TreeNode): Directory {
    return new Directory(
        [...node.entries()].map(([key, value]) => {
            if (value instanceof Uint8Array) {
                return [key, new File(value)];
            } else {
                return [key, convert(value)];
            }
        })
    )
}
