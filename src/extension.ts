import * as vscode from 'vscode';

class GPTWithContextTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(element: vscode.TreeItem) { return element; }
	getChildren(element?: vscode.TreeItem) {
		if (element) { return []; }
		return [
			new vscode.TreeItem('Tree item A'),
			new vscode.TreeItem('Tree item B'),
		];
	}
}

class GPTWithContextViewProvider implements vscode.WebviewViewProvider {
  constructor(
		private readonly _context: vscode.ExtensionContext,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'dist')],
    };

    const scriptUri = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'dist', 'webview.js'));
    webviewView.webview.html = `
      <html>
        <body>
          <script src="${scriptUri}"></script>

          <p>This is the GPT with Context Plugin.<p>
          <p>It enables to chat with GPT whilst sending all your files to provide some context.</p>

          <vscode-button id="test_button">Test Button</vscode-button>

          <script>
            const vscode = acquireVsCodeApi();

            document.getElementById('test_button').addEventListener('click', () => {
              vscode.postMessage({
                command: 'command',
                text: 'Test Button has been clicked!',
              });
            });
          </script>
        </body>
      </html>
    `;

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === 'command') { vscode.window.showInformationMessage(message.text); }
    });
  }
}

export const activate = (context: vscode.ExtensionContext) => {
  console.log('GPT with Context extension activated');

  context.subscriptions.push(vscode.window.registerWebviewViewProvider('gpt-with-context.MainView', new GPTWithContextViewProvider(context)));

  context.subscriptions.push(
    vscode.commands.registerCommand('gpt-with-context.testCommand', () => {
      vscode.window.showInformationMessage('testcommand');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gpt-with-context.helloWorld', () => {
      vscode.window.showInformationMessage('Hello World from GPT with Context!');
    })
  );
};

export const deactivate = () => {};
