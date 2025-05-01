import zigTar from "url:./zig.tar.gz";
import { ungzip } from "pako";
import { untar } from "@immutabl3/tar";
import { Directory, File } from "@bjorn3/browser_wasi_shim";

export async function getLatestZigArchive() {
    const archive = await (await fetch(zigTar, {})).arrayBuffer();
    const entries = await untar(ungzip(archive));

    let root: TreeNode = new Map();

    for (const e of entries) {
        if (e.type !== "file") continue;
        if (!e.path.startsWith("lib/")) continue;
        const path = e.path.slice("lib/".length);
        const splitPath = path.split("/");

        let c = root;
        for (const segment of splitPath.slice(0, -1)) {
            if (!c.has(segment)) {
                c.set(segment, new Map());
            }
            c = c.get(segment) as TreeNode;
        }


        c.set(splitPath[splitPath.length - 1], e.getBinary());
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
