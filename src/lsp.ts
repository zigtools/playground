import { basicSetup } from "codemirror";
import { Text } from "@codemirror/state";
import {
  EditorView,
  keymap,
} from "@codemirror/view";
import DOMPurify from "dompurify";
import {
  LSPPlugin,
  Transport,
  LSPClient,
  languageServerExtensions,
  LSPClientExtension,
  Workspace,
  WorkspaceFile,
  formatDocument,
} from "@codemirror/lsp-client";
import { zigLanguage } from "@ndim/codemirror-lang-zig";
// @ts-ignore
import ZLSWorker from "./workers/zls.ts?worker";

import { indentWithTab } from "@codemirror/commands";
import { indentUnit, syntaxHighlighting } from "@codemirror/language";
import { editorTheme, highlightStyle } from "./theme.ts";
import {
  semanticTokensClientCapabilities,
  semanticTokensState,
  semanticTokensPlugin,
} from "./semantic_tokens.ts";

class ZlsTransport implements Transport {
  public worker: Worker;
  handlers: ((value: string) => void)[] = [];

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener("message", this.messageHandler);
  }

  subscribe(handler: (value: string) => void) {
    this.handlers.push(handler);
  }
  unsubscribe(handler: (value: string) => void) {
    this.handlers = this.handlers.filter((h) => h != handler);
  }

  private messageHandler = (ev: MessageEvent) => {
    const data = JSON.parse(ev.data);

    if (data.method == "window/logMessage") {
      if (!data.stderr) {
        switch (data.params.type) {
          case 5:
            console.debug("ZLS --- ", data.params.message);
            break;
          case 4:
            console.log("ZLS --- ", data.params.message);
            break;
          case 3:
            console.info("ZLS --- ", data.params.message);
            break;
          case 2:
            console.warn("ZLS --- ", data.params.message);
            break;
          case 1:
            console.error("ZLS --- ", data.params.message);
            break;
          default:
            console.error(data.params.message);
            break;
        }
      }
    } else {
      console.debug("LSP <<-", data);
    }

    const stringified = JSON.stringify(data);
    for (const handler of this.handlers) {
      handler(stringified);
    }
  };

  send(message: string) {
    console.debug("LSP ->>", JSON.parse(message));
    if (this.worker) {
      this.worker.postMessage(message);
    }
  }
}

class PlaygroundWorkspaceFile implements WorkspaceFile {
  uri: string;
  languageId: string;
  version: number;
  doc: Text;
  view: EditorView;
  button: HTMLButtonElement;

  constructor(
    uri: string,
    languageId: string,
    version: number,
    view: EditorView,
    button: HTMLButtonElement,
  ) {
    this.uri = uri;
    this.languageId = languageId;
    this.version = version;
    this.doc = view.state.doc;
    this.view = view;
    this.button = button;
  }

  getView(main?: EditorView): EditorView {
    return this.view;
  }
}

class PlaygroundWorkspace extends Workspace {
  files: PlaygroundWorkspaceFile[] = [];

  getFile(uri: string): WorkspaceFile | null {
    console.log("getFile: ", uri);
    return super.getFile(uri);
  }

  syncFiles() {
    let result = [];
    for (let file of this.files) {
      const view = file.getView()!;
      let plugin = LSPPlugin.get(view);
      if (!plugin) continue
      const changes = plugin.unsyncedChanges;
      if (!changes.empty) {
        result.push({changes, file, prevDoc: file.doc});
        file.doc = view.state.doc;
        file.version += 1;
        plugin.clear();
      }
    }
    return result;
  }
  openFile(uri: string, languageId: string, view: EditorView): void {
    console.log("openFile: ", uri);
    if (this.getFile(uri)) {
      throw new Error("implementation doesn't support multiple views on the same file");
    }

    const button = document.createElement("button");
    button.className = "tab";
    button.innerText = (new URL(uri)).pathname.substring(1);
    document.getElementById("tab-bar")!.appendChild(button);

    button.addEventListener("mousedown", (e) => {
      switch (e.button) { 
        case 0: {
          this.showView(view);
          break;
        }
        case 1: {
          e.preventDefault();
          if (this.files.length <= 1) return;
          this.closeFile(uri, view);
          break;
        }
      }
    });
    const file = new PlaygroundWorkspaceFile(uri, languageId, 0, view, button);
    this.files.push(file);
    this.client.didOpen(file);
  }
  closeFile(uri: string, view: EditorView): void {
    console.log("closeFile: ", uri);
    const closedFile = this.getFile(uri)! as PlaygroundWorkspaceFile;
    const files = this.files.filter(f => f != closedFile);
    const newlyFocusedFile = files[files.length - 1];
    this.showView(newlyFocusedFile.getView()!);
    document.getElementById("tab-bar")!.removeChild(closedFile.button);
    this.files = files;
    this.client.didClose(uri);
  }

  createAndOpenUnnamedFile(doc: string): void {
    const uri = this.getDistinctFileUri();
    console.log("createAndOpenUnnamedFile: ", uri);
    const view = new EditorView({
      parent: document.getElementById("editor")!,
      doc: "// " +  uri + "\n\n" + doc,
      extensions: [
        basicSetup,
        editorTheme,
        indentUnit.of("    "),
        keymap.of([
          indentWithTab,
          // {
          //   key: "Mod-s",
          //   run: formatDocument,
          // },
          {
            key: "Mod-s",
            run:  (target: EditorView) => {
              console.log("run");
              const workspace = lspClient.workspace as PlaygroundWorkspace;
              workspace.createAndOpenUnnamedFile("");
              return true;
            },
          }
        ]),
        zigLanguage,
        syntaxHighlighting(highlightStyle),
        EditorView.domEventHandlers({
          paste(event, view) {
            if(!view.hasFocus) {
              event.preventDefault();
            }
          }
        }),
        lspClient.plugin(uri),
      ],
    });
    this.showView(view);
  }

  showView(view: EditorView): void {
    for (const file of this.files) {
      file.getView()!.dom.style  = "display: none !important";
      if (file.getView()! == view) {
        file.button.classList.add("active");
      } else {
        file.button.classList.remove("active");
      }
    }
    view.dom.style = "";
    view.focus();

    // Hide the tab bar if only file is open
    document.getElementById("tab-bar")!.style = this.files.length <= 1 ? "display: none;" : "";
  }

  getDistinctFileUri(): string {
    var i = 0;
    while (true) {
      const uri = `file:///untitled-${i}.zig`;
      i += 1;
      const exists = this.files.some((file) => file.uri == uri);
      if (exists) continue;
      return uri;
    }
  }
}

const transport = new ZlsTransport(new ZLSWorker());
const lspClient = new LSPClient({
  sanitizeHTML(html) {
    DOMPurify.addHook("uponSanitizeAttribute", (currentNode, hookEvent) => {
      if (currentNode.nodeName.toLowerCase() !== 'a') return;
      if (hookEvent.attrName !== "href") return;
      const url = URL.parse(hookEvent.attrValue);
      if (!url) return;
      if (url.protocol != "file:") return;
      hookEvent.forceKeepAttr = true;
    })
    return DOMPurify.sanitize(html, {});
  },
  workspace(client) {
    return new PlaygroundWorkspace(client);
  },
  highlightLanguage(name) {
    if (name == "zig") return zigLanguage;
    return null;
  },
  extensions: [
    ...languageServerExtensions(),
    {
      clientCapabilities: {
        semanticTokens: semanticTokensClientCapabilities,
      },
      editorExtension: [semanticTokensState, semanticTokensPlugin],
    } satisfies LSPClientExtension,
  ],
}).connect(transport);
export { lspClient, PlaygroundWorkspace };

document.getElementById("editor")!.addEventListener('click', (e) => {
    if (!e.target) return;
    if (!(e.target instanceof HTMLElement)) return;
    if (!e.target.closest(".cm-tooltip-hover")) return;
    const link = e.target.closest('a');
    if (!link) return;
    const url = URL.parse(link.href);
    if (!url) return;
    e.preventDefault();
    lspClient.workspace.displayFile(link.href);
});
