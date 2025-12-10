import * as vscode from "vscode";
import { attachOverlay } from "./extension";

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "devpilot.sidebar";
  private _view: vscode.WebviewView | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(view: vscode.WebviewView) {
    this._view = view;

    attachOverlay(view);

    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "out")],
    };

    view.webview.html = this.getHtmlForWebview(view.webview);
  }

 private getHtmlForWebview(webview: vscode.Webview): string {
  const nonce = this.getNonce();

  // ✅ CSS file (compiled by esbuild + PostCSS)
  const cssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      this.context.extensionUri,
      "out",
      "components",
      "figma-ui",
      "styles",
      "globals.css"
    )
  );

  // ✅ Dashboard JS bundle
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      this.context.extensionUri,
      "out",
      "components",
      "figma-ui",
      "dashboard",
      "FigmaDashboard.js"
    )
  );

  // ✅ Content Security Policy
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource} 'nonce-${nonce}'`,
    `img-src ${webview.cspSource} https: data:`,
    `font-src ${webview.cspSource} https: data:`,
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevPilot Dashboard</title>

  <!-- ✅ Global CSS -->
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>
  <!-- ✅ Root for React -->
  <div id="root" style="width:100%; height:100%;"></div>

  <!-- ✅ React bundle -->
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

// -------------------------
// ✅ NONCE
// -------------------------
private getNonce(): string {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
}