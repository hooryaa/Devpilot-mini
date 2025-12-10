// src/components/figma-ui/dashboard/FigmaDashboard.tsx
declare const acquireVsCodeApi: () => {
  postMessage: (msg: any) => void;
  getState?: () => any;
  setState?: (state: any) => void;
};
const vscode = acquireVsCodeApi();

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { dashboardData } from "../../../data/dashboard-data";
import { Button } from "../ui/button.js";
import { postToExtension, onExtensionMessage } from "../../../utils/vscodeBridge";
import RightDashboard from "./RightDashboard.js";
import { ThumbsUp, ThumbsDown } from "lucide-react";

/**
 * FigmaDashboard.tsx
 *
 * - Option A: left dashboard + middle editor overlay + right feature host.
 * - Keeps the full feature set (editor sync, selection, diff, todos, theme,
 *   feature switching, chat replies) while using the cleaned state logic.
 *
 * Notes:
 * - Webview messages are expected in shape: { type, payload }.
 * - We use (window as any).initialThemeKind for initial theme token passed by extension bootstrap.
 */

function App(): React.JSX.Element {
  // persisted feature from webview state
  const initialFeatureFromState = vscode.getState?.()?.activeFeature ?? null;

  const [activeFeature, setActiveFeatureState] = useState<string | null>(initialFeatureFromState);
  const [internalActiveFeature, internalSetActiveFeature] = useState<string | null>(initialFeatureFromState);

  const initialTheme = (typeof window !== "undefined" && (window as any).initialThemeKind) ?? 2;
  const [themeKind, setThemeKind] = useState<number>(initialTheme);

  const [chatReply, setChatReply] = useState<string>("");
  const [activeEditor, setActiveEditor] = useState<any>(null);
  const [cursorSelection, setCursorSelection] = useState<any[]>([]);
  const [fileDiff, setFileDiff] = useState<string>("");
  const [todos, setTodos] = useState<any[]>([]);
  const [showToolMenu, setShowToolMenu] = useState(false);

  // keep local internalActiveFeature in sync with outer setter
  useEffect(() => {
    internalSetActiveFeature(activeFeature);
  }, [activeFeature]);

  // Subscribe to extension messages (global listener + our onExtensionMessage helpers)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg?.type) return;
      const { type, payload } = msg;

      switch (type) {
        case "switchFeature":
          // extension broadcasts payload.feature
          {
            const f = payload?.feature ?? null;
            applyFeature(f);
          }
          break;

        case "theme":
          setThemeKind(payload?.kind ?? 2);
          break;

        case "activeEditor":
          setActiveEditor(payload ?? null);
          break;

        case "cursorSelection":
          setCursorSelection(payload?.selections || []);
          break;

        case "fileDiff":
          setFileDiff(payload?.diff || "");
          break;

        case "todosResult":
          setTodos(payload?.todos || []);
          break;

        default:
          break;
      }
    };

    window.addEventListener("message", handler);

    // subscribe to named message handlers (we implemented onExtensionMessage to return unsubscribe)
    const unsubChat = onExtensionMessage("chatReply", (payload: any) => {
      setChatReply(payload?.text ?? "");
    });

    return () => {
      window.removeEventListener("message", handler);
      if (typeof unsubChat === "function") unsubChat();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist activeFeature in webview state so it survives reloads
  useEffect(() => {
    try {
      vscode.setState?.({ activeFeature: activeFeature ?? null });
    } catch {
      // ignore if not available
    }
  }, [activeFeature]);

  // Centralized setter that broadcasts the feature change to the extension & other webviews
const applyFeature = (feature: string | null) => {
  setActiveFeatureState(feature);
  internalSetActiveFeature(feature);

  // ✅ CORRECT: ask extension to switch feature
  postToExtension("command", {
    command: "devpilot.setActiveFeature",
    args: [feature],
  });

  try {
    vscode.setState?.({ activeFeature: feature ?? null });
  } catch {
    // noop
  }
};

  const handleKeyPress = (event: React.KeyboardEvent, featureId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      applyFeature(featureId);
    }
  };

  const handleChatMessage = (text: string) => {
    // send to extension which will respond with chatReply
    postToExtension("chatMessage", { text });
    try {
      vscode.postMessage?.({ type: "chatMessage", payload: { text } });
    } catch {
      // noop
    }
  };

  // Small shared inline styles for panels (VS Code theming via CSS vars)
  const panelStyle: React.CSSProperties = {
    borderColor: "var(--vscode-panel-border)",
    backgroundColor: "var(--vscode-editor-background)",
  };

  return (
    <div
      role="region"
      aria-label="DevPilot Dashboard"
      style={{
        width: "100%",
        height: "100vh",
        display: "grid",
        gridTemplateColumns: "280px 1fr 360px",
        overflow: "hidden",
        backgroundColor: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
      }}
    >
      {/* ---------- Left Panel (Dashboard & Menu) ---------- */}
      <aside
        style={{
          ...panelStyle,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflowY: "auto",
          padding: 24,
          boxSizing: "border-box",
          borderRight: "1px solid var(--vscode-panel-border)",
        }}
      >
        {/* Sticky Top: Menu button */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: 8, left: 8 }}>
            <Button
              aria-label="Open DevPilot Tools Menu"
              onClick={() => setShowToolMenu((s) => !s)}
              style={{ borderRadius: 999, padding: "6px 10px", fontSize: 12 }}
            >
              ⋯
            </Button>
          </div>

          {showToolMenu && (
            <div
              style={{
                position: "absolute",
                top: 40,
                left: 8,
                zIndex: 40,
                padding: 8,
                borderRadius: 6,
                boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                backgroundColor: "var(--vscode-editor-background)",
                border: "1px solid var(--vscode-panel-border)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Button onClick={() => applyFeature("commit")} style={{ fontSize: 13 }}>
                  Commit Generator
                </Button>
                <Button onClick={() => applyFeature("chat")} style={{ fontSize: 13 }}>
                  Learning Chatbot
                </Button>
                <Button onClick={() => applyFeature("todo")} style={{ fontSize: 13 }}>
                  Todo Tracker
                </Button>
                <Button onClick={() => applyFeature("help")} style={{ fontSize: 13 }}>
                  Help
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Dashboard content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* User card */}
          <div
            style={{
              border: "1px solid var(--vscode-panel-border)",
              borderRadius: 8,
              padding: 14,
              backgroundColor: "var(--vscode-editor-background)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
              Welcome, {dashboardData.user.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)" }}>
              {dashboardData.user.role} • {dashboardData.user.activeTrack}
            </div>
          </div>

          {/* Learning Progress */}
          <div style={{ border: "1px solid var(--vscode-panel-border)", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Learning Progress</div>
            <div style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)", marginBottom: 8 }}>
              {dashboardData.progress.completedLessons} / {dashboardData.progress.totalLessons} lessons completed
            </div>
            <div
              style={{
                width: "100%",
                backgroundColor: "var(--vscode-editor-background)",
                height: 8,
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(dashboardData.progress.completedLessons / Math.max(1, dashboardData.progress.totalLessons)) * 100}%`,
                  backgroundColor: "var(--vscode-inputValidation-infoBorder)",
                }}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--vscode-descriptionForeground)" }}>
              Streak: {dashboardData.progress.streak} days
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ border: "1px solid var(--vscode-panel-border)", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Recent Activity</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dashboardData.recentActivity.map((item) => (
                <Button
                  key={item.id}
                  onClick={() => applyFeature(item.id.toString())}
                  onKeyDown={(e) => handleKeyPress(e as any, item.id.toString())}
                  aria-label={`Activate feature: ${item.title}`}
                  style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 10px" }}
                >
                  <span>{item.title}</span>
                  <span style={{ color: "var(--vscode-descriptionForeground)" }}>{item.time}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Practice Problems / Quizzes */}
          <div style={{ border: "1px solid var(--vscode-panel-border)", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Practice Problems / Quizzes</div>
            {["HTML", "CSS", "JavaScript"].map((lang) => {
              const quizzes = dashboardData.practiceProblems.filter((p) =>
                p.id.startsWith(`quiz-${lang.toLowerCase()}`)
              );
              return (
                <div key={lang} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{lang}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {quizzes.map((quiz) => (
                      <Button
                        key={quiz.id}
                        onClick={() => applyFeature(quiz.id)}
                        aria-label={`Start ${quiz.title}`}
                        style={{ fontSize: 13, padding: "8px 10px" }}
                      >
                        {quiz.title}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom section */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ border: "1px solid var(--vscode-panel-border)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Quick Actions</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button style={{ fontSize: 13, height: 36 }} onClick={() => postToExtension("requestActiveEditor", {})}>
                Get Active File
              </Button>
              <Button style={{ fontSize: 13, height: 36 }} onClick={() => postToExtension("openTestFile", {})}>
                Open Test File
              </Button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Button
              aria-label="Thumbs Up"
              onClick={() => postToExtension("feedback", { rating: "up" })}
              style={{ padding: "6px 10px" }}
            >
              <ThumbsUp size={14} />
            </Button>
            <Button
              aria-label="Thumbs Down"
              onClick={() => postToExtension("feedback", { rating: "down" })}
              style={{ padding: "6px 10px" }}
            >
              <ThumbsDown size={14} />
            </Button>
          </div>
        </div>
      </aside>

      {/* ---------- Middle Editor Space (Live overlays only) ---------- */}
      <main style={{ position: "relative", overflow: "hidden", height: "100%", backgroundColor: "transparent" }}>
        {activeEditor && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              fontSize: 12,
              padding: "6px 8px",
              borderRadius: 6,
              backgroundColor: "var(--vscode-editorHoverWidget-background)",
              color: "var(--vscode-editor-foreground)",
            }}
            title={activeEditor?.uri || ""}
          >
            {activeEditor.fileName} • {cursorSelection.length} selections • {activeEditor?.languageId}
          </div>
        )}

        {fileDiff && (
          <pre
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              fontSize: 12,
              maxWidth: 340,
              overflow: "hidden",
              borderRadius: 6,
              padding: 8,
              backgroundColor: "var(--vscode-editorHoverWidget-background)",
              color: "var(--vscode-editor-foreground)",
            }}
          >
            {fileDiff.slice(0, 300)}
            {fileDiff.length > 300 ? "..." : ""}
          </pre>
        )}

        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--vscode-descriptionForeground)",
            fontSize: 13,
            padding: 12,
            boxSizing: "border-box",
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>Editor preview</div>
            <div style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)" }}>
              Live file text, selection and diff overlays appear here when a file is open in the editor.
            </div>
          </div>
        </div>
      </main>

      {/* ---------- Right Panel (Feature host) ---------- */}
      <aside style={{ borderLeft: "1px solid var(--vscode-panel-border)", overflowY: "auto" }}>
        <RightDashboard initialFeature={internalActiveFeature} initialThemeKind={themeKind} />
      </aside>

      {/* ---------- Version Branding ---------- */}
      <div style={{ position: "fixed", top: 12, right: 12 }}>
        <div
          style={{
            border: "1px solid var(--vscode-panel-border)",
            padding: "6px 10px",
            borderRadius: 6,
            backgroundColor: "var(--vscode-editor-background)",
            color: "var(--vscode-foreground)",
            fontSize: 12,
          }}
        >
          DevPilot v2.1.0
        </div>
      </div>
    </div>
  );
}

/* Webview-safe mount */
function renderDashboard() {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    // eslint-disable-next-line no-console
    console.error("#root not found");
    return;
  }
  const root = ReactDOM.createRoot(rootEl);
  root.render(<App />);
}

window.addEventListener("DOMContentLoaded", renderDashboard);

export {};
