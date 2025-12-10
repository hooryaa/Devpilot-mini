// src/components/figma-ui/dashboard/RightDashboard.tsx
import React, { useEffect, useState, Suspense } from "react";
import { Button } from "../ui/button.js";
import { postToExtension, onExtensionMessage } from "../../../utils/vscodeBridge";
import { dashboardData } from "../../../data/dashboard-data";

// Lazy-load features (must be default exports)
const CommitGenerator = React.lazy(() => import("../features/CommitGenerator.js"));
const LearningChatbot = React.lazy(() => import("../features/LearningChatbot.js"));
const TodoTracker = React.lazy(() => import("../features/TodoTracker.js"));
const QuizRunner = React.lazy(() => import("../features/QuizRunner.js"));
const HelpPanel = React.lazy(() => import("../features/HelpPanel.js"));

interface RightDashboardProps {
  // RightDashboard used as standalone in the right-panel webview, optional props for server-side render tests
  initialFeature?: string | null;
  initialThemeKind?: number;
}

export const RightDashboard: React.FC<RightDashboardProps> = ({
  initialFeature = null,
  initialThemeKind = 2,
}) => {
  const [activeFeature, setActiveFeature] = useState<string | null>(initialFeature);
  const [themeKind, setThemeKind] = useState<number>(initialThemeKind);

  // Listen for feature switch messages from the sidebar/extension
  useEffect(() => {
    const offSwitch = onExtensionMessage("switchFeature", (payload: any) => {
      // payload may be { feature } or just feature string depending on sender
      const feature = payload?.feature ?? payload;
      setActiveFeature(feature || null);
    });

    const offTheme = onExtensionMessage("theme", (payload: any) => {
      if (typeof payload?.kind === "number") setThemeKind(payload.kind);
      else if (typeof payload === "number") setThemeKind(payload);
    });

    // optionally listen for persisted restore (if extension implements it)
    const offRestore = onExtensionMessage("restoreFeature", (payload: any) => {
      const f = payload?.feature ?? payload;
      if (f) setActiveFeature(f);
    });

    return () => {
      offSwitch?.();
      offTheme?.();
      offRestore?.();
    };
  }, []);

  // Helper: tell extension to open a feature (centralized)
const openFeature = (feature: string) => {
  postToExtension("command", {
    command: "devpilot.setActiveFeature",
    args: [feature],
  });
};

  // Called by feature components to close themselves
const handleCloseFeature = () => {
  postToExtension("command", {
    command: "devpilot.setActiveFeature",
    args: [null],
  });
};

  // Chat send helper
  const handleChatSend = (text: string) => {
    // send to extension which will call OpenAI and reply back with chatReply
    postToExtension("chatMessage", { text });
  };

  // Small styles using VSCode variables
  const containerStyle: React.CSSProperties = {
    height: "100vh",
    backgroundColor: "var(--vscode-editor-background)",
    color: "var(--vscode-editor-foreground)",
    borderLeft: "1px solid var(--vscode-panel-border)",
    padding: 16,
    boxSizing: "border-box",
    overflowY: "auto",
  };

  const placeholderCard: React.CSSProperties = {
    border: "1px solid var(--vscode-panel-border)",
    backgroundColor: "var(--vscode-editor-background)",
    color: "var(--vscode-editor-foreground)",
    padding: 20,
    borderRadius: 8,
  };

  return (
    <div role="region" aria-label="DevPilot Feature Host" style={containerStyle}>
      <Suspense fallback={<div className="text-xs">Loading feature…</div>}>
        {activeFeature === "commit" && (
          <div style={{ height: "100%" }}>
            <CommitGenerator onClose={handleCloseFeature} />
          </div>
        )}

        {activeFeature === "chat" && (
          <div style={{ height: "100%" }}>
            <LearningChatbot onClose={handleCloseFeature} onSend={handleChatSend} reply={""} autoFocus />
          </div>
        )}

        {activeFeature === "todo" && (
          <div style={{ height: "100%" }}>
            <TodoTracker onClose={handleCloseFeature} />
          </div>
        )}

        {activeFeature?.startsWith("quiz-") && (
          <div style={{ height: "100%" }}>
            <QuizRunner
              onClose={handleCloseFeature}
              questions={
                dashboardData.practiceProblems.find((p) => p.id === activeFeature)?.questions || []
              }
            />
          </div>
        )}

        {activeFeature === "help" && (
          <div style={{ height: "100%" }}>
            <HelpPanel onClose={handleCloseFeature} />
          </div>
        )}

        {!activeFeature && (
          <div style={placeholderCard}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              Nothing open — select a tool
            </div>
            <div style={{ fontSize: 13, color: "var(--vscode-descriptionForeground)", marginBottom: 12 }}>
              Use the sidebar menu to open Commit Generator, Chatbot, Todo Tracker, or a Quiz. You can also
              open a feature here.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button onClick={() => openFeature("commit")} className="text-xs h-8">
                Open Commit Generator
              </Button>
              <Button onClick={() => openFeature("chat")} className="text-xs h-8">
                Open Chatbot
              </Button>
              <Button onClick={() => openFeature("todo")} className="text-xs h-8">
                Open Todo Tracker
              </Button>
              <Button onClick={() => openFeature("help")} className="text-xs h-8">
                Help
              </Button>
            </div>
          </div>
        )}
      </Suspense>
    </div>
  );
};

export default RightDashboard;
