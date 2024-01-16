import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('GPT with Context extension activated');

  context.subscriptions.push(
    vscode.window.createTreeView('GPTWithContext_MainView', {
      treeDataProvider: {
        getTreeItem: (element: vscode.TreeItem) => element,
        getChildren: (element?: vscode.TreeItem) => {
          if (element) { return []; }
          return [
            new vscode.TreeItem('Tree item 1'),
            new vscode.TreeItem('Tree item 2'),
          ];
        },
      },
    })
  );

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
}

export function deactivate() {}
