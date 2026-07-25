import {
  Transport,
  LSPClient,
  languageServerExtensions,
  LSPClientExtension,
} from "@codemirror/lsp-client";
import { zigLanguage } from "@ndim/codemirror-lang-zig";
// @ts-ignore
import ZLSWorker from "./workers/zls.ts?worker";

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

const transport = new ZlsTransport(new ZLSWorker());
const lspClient = new LSPClient({
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
export { lspClient };
