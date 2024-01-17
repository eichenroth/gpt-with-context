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
	private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
		private readonly _context: vscode.ExtensionContext,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist')]
    };

    const webviewScriptUri1 = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(
      this._extensionUri, 'dist', 'webview.js'));
    const webviewScriptUri2 = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(
      this._extensionUri, 'out', 'webview.js'));
    const webviewScriptUri3 = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(
      this._extensionUri, 'media', 'webview.js'));
    const webviewScriptUri4 = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(
      this._extensionUri, 'webview.js'));

    // add this:          <vscode-button>VSCode button</vscode-button>

    webviewView.webview.html = `
      <html>
        <head>
          <script src="${webviewScriptUri1}"></script>
          <script src="${webviewScriptUri2}"></script>
          <script src="${webviewScriptUri3}"></script>
          <script src="${webviewScriptUri4}"></script>
        </head>
        <body>
          <h1>GPT with Context</h1>
          <p>${webviewScriptUri1}</p>
          <p>Webview view</p>
          <button id="testButton">Test button</button>
          <vscode-button>VSCode button</vscode-button>
          <script>
            const vscode = acquireVsCodeApi();
            document.getElementById('testButton').addEventListener('click', () => {
              vscode.postMessage({
                command: 'testCommand',
                text: 'Hello from the webview',
              });
            });
          </script>
        </body>
      </html>
    `;

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case 'testCommand':
          vscode.window.showInformationMessage(message.text);
          break;
      }
    });
  }
}

export const activate = (context: vscode.ExtensionContext) => {
  console.log('GPT with Context extension activated');

  context.subscriptions.push(vscode.window.registerWebviewViewProvider('gpt-with-context.MainView', new GPTWithContextViewProvider(context.extensionUri, context)));

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
