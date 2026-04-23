import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

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
    },
    ".cm-completionIcon": {
      display: "none",
    },
    ".cm-completionLabel": {
      fontFamily: "monospace",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li > .cm-completionDetail": {
        color: "#aaaaaa",
      }
    }
  }
);

export const highlightStyle = HighlightStyle.define([
  { tag: tags.definitionKeyword, class: "st-keyword" },
  { tag: tags.modifier, class: "st-keyword" },
  { tag: tags.controlKeyword, class: "st-keyword" },
  { tag: tags.labelName, class: "st-label" },
  { tag: tags.keyword, class: "st-builtin" },
  {
    tag: tags.function(tags.definition(tags.variableName)),
    class: "st-function",
  },
  // { tag: tags.typeName, class: "st-type" },
  { tag: tags.lineComment, class: "st-comment" },
  { tag: tags.number, class: "st-number" },
  { tag: tags.string, class: "st-string" },
]);
