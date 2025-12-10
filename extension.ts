import * as vscode from "vscode";
import * as path from "path";
import OpenAI from "openai";
import simpleGit from "simple-git";
import { SidebarViewProvider } from "./SidebarViewProvider";
import { EditorOverlayProvider } from "./EditorOverlayProvider";

/* -------------------------------- Globals -------------------------------- */

let openaiApiKey: string | undefined;
let rightPanel: vscode.WebviewPanel | null = null;
let devPilotSidebar: vscode.WebviewView | null = null;
let devPilotOverlay: vscode.WebviewView | null = null;
let webviewReady = false;
let extensionContext: vscode.ExtensionContext | null = null;

/* -------------------------------- Attach Hooks -------------------------------- */

export function attachSidebar(view: vscode.WebviewView) {
  devPilotSidebar = view;
}

export function attachOverlay(view: vscode.WebviewView) {
  devPilotOverlay = view;
}

/* -------------------------------- Utilities -------------------------------- */

function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

function debounce(fn: (...args: any[]) => void, delay = 400) {
  let timer: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function saveQuizProgress(
  quizId: string,
  score: number,
  total: number,
  context?: vscode.ExtensionContext | any
) {
  const ctx =
    context &&
    typeof (context as vscode.ExtensionContext).globalState !== "undefined"
      ? (context as vscode.ExtensionContext)
      : extensionContext;

  if (!ctx) {
    return;
  }

  const existing =
    ctx.globalState.get<Record<string, any>>("devpilot.quizProgress") || {};

  existing[quizId] = {
    score,
    total,
    lastAttempt: Date.now(),
  };

  ctx.globalState.update("devpilot.quizProgress", existing);
}

/* -------------------------------- Activate -------------------------------- */

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;

  openaiApiKey = context.globalState.get<string>("devpilot.openaiKey");

  /* ---------------- Sidebar Provider ---------------- */

  const sidebarProvider = new SidebarViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarViewProvider.viewType,
      sidebarProvider
    )
  );

  /* ---------------- Overlay Provider ---------------- */

  const overlayProvider = new EditorOverlayProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      EditorOverlayProvider.viewType,
      overlayProvider
    )
  );

  /* ---------------- Core Commands ---------------- */

  const register = (cmd: string, cb: (...args: any[]) => any) =>
    context.subscriptions.push(vscode.commands.registerCommand(cmd, cb));

  register("devpilot.setOpenAIKey", async () => {
    const apiKey = await vscode.window.showInputBox({
      placeHolder: "Enter your OpenAI API Key",
      password: true,
      ignoreFocusOut: true,
    });

    openaiApiKey = apiKey;
    await context.globalState.update("devpilot.openaiKey", apiKey);
    vscode.window.showInformationMessage("OpenAI key saved.");
  });

  register("devpilot.openDashboard", openRightPanel);
  register("devpilot.openPanel", openRightPanel);

  /* ---------------- Active Feature Sync Command ---------------- */

  register("devpilot.setActiveFeature", ({ feature }: { feature: string }) => {
    context.globalState.update("devpilot.activeFeature", feature);

    safePost({
      type: "switchFeature",
      payload: { feature },
    });
  });

  /* ---------------- Feature Commands ---------------- */

  const features = [
    { cmd: "devpilot.openCommitGenerator", feature: "commit" },
    { cmd: "devpilot.openChatbot", feature: "chat" },
    { cmd: "devpilot.openTodoTracker", feature: "todo" },
    { cmd: "devpilot.quizHtmlEasy", feature: "quiz-html-easy" },
    { cmd: "devpilot.quizCssHard", feature: "quiz-css-hard" },
    { cmd: "devpilot.quizJsMedium", feature: "quiz-js-medium" },
    { cmd: "devpilot.quizHtmlMedium", feature: "quiz-html-medium" },
    { cmd: "devpilot.quizCssEasy", feature: "quiz-css-easy" },
    { cmd: "devpilot.quizJsEasy", feature: "quiz-js-easy" },
  ];

  features.forEach(({ cmd, feature }) => {
    register(cmd, () => {
      openRightPanel();
      context.globalState.update("devpilot.activeFeature", feature);
      safePost({
        type: "switchFeature",
        payload: { feature },
      });
    });
  });

  /* ---------------- Quick Action Auto-Mapping ---------------- */

  const quickActionMap: Record<string, string> = {
    learn: "devpilot.openPanel",
    chat: "devpilot.openChatbot",
    commit: "devpilot.openCommitGenerator",
    todo: "devpilot.openTodoTracker",
  };

  register("devpilot.quickAction", (actionId: string) => {
    const command = quickActionMap[actionId];
    if (!command) {
      return;
    }

    vscode.commands.executeCommand(command);
  });

  /* ---------------- Realtime Sync (Debounced) ---------------- */

  const syncEditorDebounced = debounce(() => {
    sendActiveEditor();
    sendTODOs();
  });

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => sendActiveEditor()),
    vscode.window.onDidChangeTextEditorSelection((e) =>
      sendCursorSelection(e.textEditor)
    ),
    vscode.workspace.onDidChangeTextDocument((e) => {
      sendFileDiff(e.document);
      syncEditorDebounced();
    }),
    vscode.workspace.onDidOpenTextDocument(() => sendActiveEditor()),
    vscode.workspace.onDidCloseTextDocument(() => sendActiveEditor()),
    vscode.workspace.onDidSaveTextDocument(() => sendActiveEditor())
  );

  /* ---------------- Theme Sync ---------------- */

  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme((theme) =>
      safePost({
        type: "theme",
        payload: { kind: theme.kind },
      })
    )
  );

  /* ---------------- Restore Feature ---------------- */

  const savedFeature =
    context.globalState.get<string>("devpilot.activeFeature");

  if (savedFeature) {
    openRightPanel();
    safePost({
      type: "switchFeature",
      payload: { feature: savedFeature },
    });
  }

  const savedQuizProgress = context.globalState.get("devpilot.quizProgress");

  if (savedQuizProgress) {
    safePost({
      type: "quizProgress",
      payload: savedQuizProgress,
    });
  }

  sendActiveEditor();
  sendTODOs();
}

/* ------------------------------ Right Panel ------------------------------ */

function openRightPanel() {
  if (rightPanel) {
    rightPanel.reveal(vscode.ViewColumn.Two);
    return;
  }

  const extension = vscode.extensions.getExtension("hooriaamir.devpilot");
  if (!extension) {
    return;
  }

  webviewReady = false;

  rightPanel = vscode.window.createWebviewPanel(
    "devpilotPanel",
    "DevPilot",
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extension.extensionUri, "out")],
    }
  );

  rightPanel.webview.html = getFeatureHostContent(rightPanel.webview);

  rightPanel.webview.onDidReceiveMessage(async (msg) => {
    if (msg?.type === "ready") {
      webviewReady = true;
    }
    await handleIncomingMessage(msg, rightPanel);
  });

  rightPanel.onDidDispose(() => {
    rightPanel = null;
    webviewReady = false;
  });
}

/* ------------------------------ Broadcaster ------------------------------ */

function safePost(message: { type: string; payload?: any }) {
  if (!webviewReady && message.type === "switchFeature") {
    return;
  }

  try {
    rightPanel?.webview.postMessage(message);
    devPilotSidebar?.webview.postMessage(message);
    devPilotOverlay?.webview.postMessage(message);
  } catch {}
}

/* ------------------------------ Editor Sync ------------------------------ */

function sendActiveEditor() {
  const active = vscode.window.activeTextEditor;

  const payload = active
    ? {
        uri: active.document.uri.toString(),
        text: active.document.getText(),
        languageId: active.document.languageId,
        fileName: path.basename(active.document.fileName),
        lineCount: active.document.lineCount,
      }
    : null;

  safePost({ type: "activeEditor", payload });
}

function sendCursorSelection(editor?: vscode.TextEditor) {
  if (!editor) {
    return;
  }

  const selections = editor.selections.map((sel) => ({
    start: { line: sel.start.line, character: sel.start.character },
    end: { line: sel.end.line, character: sel.end.character },
    text: editor.document.getText(sel),
  }));

  safePost({
    type: "cursorSelection",
    payload: { selections },
  });
}

/* ------------------------------ Git Diff ------------------------------ */

async function sendFileDiff(document?: vscode.TextDocument) {
  if (!document) {
    return;
  }
  try {
    const git = simpleGit();
    const diff = await git.diff(["--", document.uri.fsPath]);
    safePost({ type: "fileDiff", payload: { diff } });
  } catch {}
}

/* ------------------------------ TODO Scanner ------------------------------ */

async function sendTODOs() {
  safePost({
    type: "todosResult",
    payload: { todos: await scanTODOs() },
  });
}

async function scanTODOs() {
  const todos: { file: string; line: number; text: string }[] = [];
  const files = await vscode.workspace.findFiles(
    "**/*.{ts,tsx,js,jsx,py,java}",
    "**/node_modules/**"
  );

  for (const file of files) {
    try {
      const doc = await vscode.workspace.openTextDocument(file);
      doc.getText().split("\n").forEach((line, idx) => {
        if (line.includes("TODO")) {
          todos.push({
            file: path.basename(file.fsPath),
            line: idx + 1,
            text: line.trim(),
          });
        }
      });
    } catch {}
  }

  return todos;
}

/* ------------------------------ Messaging ------------------------------ */

async function handleIncomingMessage(
  message: any,
  source: vscode.WebviewPanel | vscode.WebviewView | null
) {
  if (!message?.type) {
    return;
  }

  const respond = (msg: any) => {
    try {
      source?.webview.postMessage(msg);
    } catch {}
  };

  switch (message.type) {
    case "applyEdit":
      try {
        const edit = new vscode.WorkspaceEdit();
        const target = vscode.Uri.parse(message.payload.uri);

        for (const e of message.payload.edits || []) {
          edit.replace(
            target,
            new vscode.Range(
              new vscode.Position(
                e.range.start.line,
                e.range.start.character
              ),
              new vscode.Position(
                e.range.end.line,
                e.range.end.character
              )
            ),
            e.newText
          );
        }

        await vscode.workspace.applyEdit(edit);
        respond({ type: "applyEditResult", payload: { ok: true } });
      } catch (err) {
        respond({
          type: "applyEditResult",
          payload: { ok: false, error: String(err) },
        });
      }
      break;

    case "generateCommit":
      respond({
        type: "commitResult",
        payload: { text: await generateCommitMessage() },
      });
      break;

    case "chatMessage":
      respond({
        type: "chatReply",
        payload: {
          text: await handleChat(message.payload?.text ?? ""),
        },
      });
      break;
  }
}

/* ------------------------------ Webview HTML ------------------------------ */

function getFeatureHostContent(webview: vscode.Webview): string {
  return buildWebviewContent(webview, "RightDashboard.js");
}

function buildWebviewContent(
  webview: vscode.Webview,
  scriptName: string
): string {
  const extension = vscode.extensions.getExtension("hooriaamir.devpilot");
  if (!extension) {
    return "<h1>Extension not found.</h1>";
  }

  const nonce = getNonce();
  const extensionUri = extension.extensionUri;

  const indexCss = webview.asWebviewUri(
    vscode.Uri.joinPath(
      extensionUri,
      "out",
      "components",
      "figma-ui",
      "index.css"
    )
  );

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      extensionUri,
      "out",
      "components",
      "figma-ui",
      "dashboard",
      scriptName
    )
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource} 'nonce-${nonce}';">
  <link rel="stylesheet" href="${indexCss}">
  <style nonce="${nonce}">
    html, body, #root {
      height: 100%;
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body class="devpilot-root">
  <div id="root"></div>
  <script nonce="${nonce}">
    window.acquireVsCodeApi = acquireVsCodeApi;
    acquireVsCodeApi().postMessage({ type: "ready" });
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

/* ------------------------------ OpenAI ------------------------------ */

async function generateCommitMessage() {
  if (!openaiApiKey) {
    return "API key not set.";
  }
  try {
    const git = simpleGit();
    const diff = await git.diff();
    const client = new OpenAI({ apiKey: openaiApiKey });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Write concise Git commit messages." },
        { role: "user", content: diff },
      ],
    });

    return (
      response.choices?.[0]?.message?.content?.trim() ??
      "No commit generated."
    );
  } catch (err) {
    console.error("Commit Error:", err);
    return "Commit generation failed.";
  }
}

async function handleChat(text: string) {
  if (!openaiApiKey) {
    return "API key not set.";
  }
  try {
    const client = new OpenAI({ apiKey: openaiApiKey });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: text }],
    });

    return response.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("Chat Error:", err);
    return "Chat failed.";
  }
}

export function deactivate() {}
