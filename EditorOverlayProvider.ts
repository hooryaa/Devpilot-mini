import * as vscode from "vscode";
import { attachOverlay } from "./extension";

export class EditorOverlayProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "devpilot.editorOverlay";

  private _view: vscode.WebviewView | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(view: vscode.WebviewView) {
    this._view = view;

    // attach to extension so it can post messages
    attachOverlay(view);

    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "out"),
      ],
    };

    view.webview.html = this.getHtmlForWebview(view.webview);

    view.webview.onDidReceiveMessage((msg) => {
      if (!msg?.type) {
        return;
      }

      switch (msg.type) {
        case "requestActiveEditor":
          // extension already broadcasts activeEditor; optionally trigger a refresh
          view.webview.postMessage({
            type: "requestActiveEditor",
            payload: {},
          });
          break;

        default:
          console.warn("Unknown EditorOverlay message:", msg);
      }
    });

    // ensure theme kept in sync
    vscode.window.onDidChangeActiveColorTheme((theme) => {
      view.webview.postMessage({
        type: "theme",
        payload: { kind: theme.kind },
      });
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = this.getNonce();

    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "out",
        "components",
        "figma-ui",
        "index.css"
      )
    );

    const globalsCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "out",
        "components",
        "figma-ui",
        "styles",
        "globals.css"
      )
    );

    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "out",
        "components",
        "figma-ui",
        "dashboard",
        "EditorOverlay.js"
      )
    );

    const csp = `
      default-src 'none';
      img-src ${webview.cspSource} https: data:;
      style-src ${webview.cspSource} 'self';
      font-src ${webview.cspSource} https: data:;
      script-src ${webview.cspSource} 'nonce-${nonce}';
    `;

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <link rel="stylesheet" href="${cssUri}">
    <link rel="stylesheet" href="${globalsCssUri}">

    <style nonce="${nonce}">
      html, body, #root {
        height: 100%;
        margin: 0;
        padding: 0;
      }
    </style>

    <title>DevPilot — Editor Overlay</title>
  </head>

  <body class="devpilot-root">
    <div id="root"></div>

    <script nonce="${nonce}">
      (function () {
        const vscode = acquireVsCodeApi();

        window.acquireVsCodeApi = function () {
          return vscode;
        };

        window.initialThemeKind = ${vscode.window.activeColorTheme.kind};

        vscode.postMessage({ type: "helloFromEditorOverlay" });
      })();
    </script>

    <script nonce="${nonce}" src="${jsUri}"></script>
  </body>
</html>`;
  }

  private getNonce() {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < 32; i++) {
      text += possible.charAt(
        Math.floor(Math.random() * possible.length)
      );
    }

    return text;
  }
}
