// src/components/figma-ui/dashboard/EditorOverlay.tsx

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  postToExtension,
  onExtensionMessage,
} from "../../../utils/vscodeBridge";
import { Button } from "../ui/button.js";

/**
 * EditorOverlay — shows live info about the active editor:
 * - file name + path (provided in activeEditor)
 * - line count
 * - selections count
 * - quick commit suggestion (calls generateCommit)
 * - displays top of file diff
 * - tracks themeKind
 */

export const EditorOverlay: React.FC = () => {
  const [active, setActive] = useState<any>(null);
  const [selections, setSelections] = useState<any[]>([]);
  const [fileDiff, setFileDiff] = useState<string>("");
  const [todos, setTodos] = useState<any[]>([]);
  const [commitSuggestion, setCommitSuggestion] = useState<string>("");
  const [themeKind, setThemeKind] = useState<number>(
    window.initialThemeKind ?? 2
  );

  useEffect(() => {
    // request initial active editor
    postToExtension("requestActiveEditor");

    const offActive = onExtensionMessage("activeEditor", (payload) => {
      setActive(payload);
    });

    const offSel = onExtensionMessage("cursorSelection", (payload) => {
      setSelections(payload?.selections || []);
    });

    const offDiff = onExtensionMessage("fileDiff", (payload) => {
      setFileDiff(payload?.diff || "");
    });

    const offTodos = onExtensionMessage("todosResult", (payload) => {
      setTodos(payload?.todos || []);
    });

    const offCommit = onExtensionMessage("commitResult", (payload) => {
      setCommitSuggestion(payload?.text || "");
    });

    const offTheme = onExtensionMessage("theme", (payload) => {
      setThemeKind(payload?.kind ?? window.initialThemeKind ?? 2);
    });

    return () => {
      offActive?.();
      offSel?.();
      offDiff?.();
      offTodos?.();
      offCommit?.();
      offTheme?.();
    };
  }, []);

  const requestCommit = () => {
    postToExtension("generateCommit", {});
  };

  const openFile = () => {
    if (!active?.uri) return;
    postToExtension("openFile", { uri: active.uri });
  };

  const containerStyle: React.CSSProperties = {
    border: "1px solid var(--vscode-panel-border)",
    backgroundColor: "var(--vscode-editorHoverWidget-background)",
    color: "var(--vscode-editor-foreground)",
    padding: 12,
    borderRadius: 8,
    width: 340,
    boxSizing: "border-box",
  };

  return (
    <div style={{ padding: 8, boxSizing: "border-box" }}>
      <div style={containerStyle}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {active?.fileName || "No file"}
            </div>

            <div
              style={{
                fontSize: 11,
                color: "var(--vscode-descriptionForeground)",
              }}
            >
              {active?.languageId
                ? `${active.languageId} • ${active?.lineCount ?? 0} lines`
                : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={openFile} className="text-xs h-8">
              Open
            </Button>

            <Button onClick={requestCommit} className="text-xs h-8">
              Suggest Commit
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            fontSize: 12,
            color: "var(--vscode-descriptionForeground)",
            marginBottom: 8,
          }}
        >
          Selections: {selections.length} • TODOs: {todos.length}
        </div>

        {/* Commit Suggestion */}
        {commitSuggestion ? (
          <div
            style={{
              marginTop: 8,
              padding: 8,
              borderRadius: 6,
              backgroundColor: "var(--vscode-editor-background)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              Commit suggestion
            </div>

            <div style={{ fontSize: 12, marginTop: 6 }}>
              {commitSuggestion}
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: "var(--vscode-descriptionForeground)",
            }}
          >
            No commit suggestion yet — click “Suggest Commit”.
          </div>
        )}

        {/* File Diff */}
        {fileDiff ? (
          <pre
            style={{
              marginTop: 8,
              fontSize: 11,
              maxHeight: 120,
              overflow: "auto",
              backgroundColor: "transparent",
              border: "none",
            }}
          >
            {fileDiff.slice(0, 1000)}
          </pre>
        ) : null}

        {/* Theme Info */}
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: "var(--vscode-descriptionForeground)",
          }}
        >
          Theme: {themeKind}
        </div>
      </div>
    </div>
  );
};

/* ---------------- Webview-Safe Mount ---------------- */

function render() {
  const root = document.getElementById("root");

  if (!root) {
    console.error("❌ #root not found for EditorOverlay");
    return;
  }

  const app = ReactDOM.createRoot(root);
  app.render(<EditorOverlay />);
}

window.addEventListener("DOMContentLoaded", render);

export default EditorOverlay;
