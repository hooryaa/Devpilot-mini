// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

  console.log('Congratulations, your extension "devpilot" is now active!');

  // Hello World command
  const helloWorld = vscode.commands.registerCommand('devpilot.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from DevPilot!');
  });
  context.subscriptions.push(helloWorld);

  // Open Dashboard command
  const openDashboard = vscode.commands.registerCommand('devpilot.openDashboard', () => {
    vscode.window.showInformationMessage('🚀 DevPilot Dashboard opened (placeholder)');
  });
  context.subscriptions.push(openDashboard);

  // Set OpenAI API Key command
  const setOpenAIKey = vscode.commands.registerCommand('devpilot.setOpenAIKey', async () => {
    const apiKey = await vscode.window.showInputBox({
      prompt: "Enter your OpenAI API Key",
      ignoreFocusOut: true,
      password: true,
      placeHolder: "sk-..."
    });

    if (apiKey) {
      await context.secrets.store('openaiApiKey', apiKey);
      vscode.window.showInformationMessage('✅ OpenAI API Key saved securely!');
    } else {
      vscode.window.showWarningMessage('⚠️ No API key entered.');
    }
  });
  context.subscriptions.push(setOpenAIKey);
}

// This method is called when your extension is deactivated
export function deactivate() {}
