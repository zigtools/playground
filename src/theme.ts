import { EditorView } from "@codemirror/view";

export const editorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--code-background-color)",
      color: "var(--code-text-color)",
    },
    ".cm-gutter": { backgroundColor: "var(--code-background-color)" },
    ".cm-gutterElement": {
      backgroundColor: "var(--code-background-color)",
      color: "var(--code-text-color)",
    },
    ".cm-activeLine": { backgroundColor: "transparent" },
    "&.cm-focused .cm-matchingBracket": {
      backgroundColor: "#FFFFFF30",
    },
    ".cm-content": { caretColor: "var(--code-text-color)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--code-text-color)" },
    ".cm-tooltip": { 
      backgroundColor: "var(--tooltip-background)",
      color: "var(--tooltip-text)",
    }
  },
  {}
);

