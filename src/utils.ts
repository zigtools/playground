import zigTar from "url:./zig.tar.gz";
import { ungzip } from "pako";
import { untar } from "@immutabl3/tar";
import { Directory, File } from "./wasi";

export async function getLatestZigArchive() {
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
                c = c.contents[segment] as Directory;
            }

            c.contents[splitPath[splitPath.length - 1]] = new File(e.getBinary())
        }
    }

    return dirs;
}
