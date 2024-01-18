import * as vscode from 'vscode';
import { NonPersistentState, PersistentState, State } from './State';

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
    private readonly _filesToIncludeState: State<string>,
    private readonly _filesToExcludeState: State<string>,
    private readonly _filesState: State<vscode.Uri[]>,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    const filesToInclude = this._filesToIncludeState.getValue();
    const filesToExclude = this._filesToExcludeState.getValue();

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

          <div>
            <vscode-text-field
              id="question_field"
              placeholder="Ask me anything..."
              style="width:100%;"
            >
            </vscode-text-field>
          </div>
          <div>
            <vscode-text-field
              id="files_to_include_field"
              placeholder="e.g. *.ts, src/**/include"
              value="${filesToInclude}"
              style="width:100%;"
            >
              <span style="font-size:0.8em;">files to include</span>
            </vscode-text-field>
          </div>
          <div>
            <vscode-text-field
              id="files_to_exclude_field"
              placeholder="e.g. *.ts, src/**/exclude"
              value="${filesToExclude}"
              style="width:100%;"
            >
              <span style="font-size:0.8em;">files to exclude</span>
            </vscode-text-field>
          </div>
          <div id="file_count"></div>

          <script>
            const vscode = acquireVsCodeApi();
            const questionField = document.getElementById('question_field');
            const filesToIncludeField = document.getElementById('files_to_include_field');
            const filesToExcludeField = document.getElementById('files_to_exclude_field');

            questionField.addEventListener('keyup', (event) => {
              if (event.key !== 'Enter') { return; }
              if (event.shiftKey) { return; }
              vscode.postMessage({
                command: 'question',
                text: questionField.value,
              });
              questionField.value = '';
              event.preventDefault();
            });

            filesToIncludeField.addEventListener('input', (event) => {
              vscode.postMessage({
                command: 'setFilesToInclude',
                value: filesToIncludeField.value,
              });
            });
            filesToExcludeField.addEventListener('input', (event) => {
              vscode.postMessage({
                command: 'setFilesToExclude',
                value: filesToExcludeField.value,
              });
            });

            window.addEventListener('message', (event) => {
              const message = event.data;
              if (message.command === 'setFiles') {
                const fileCount = document.getElementById('file_count');
                fileCount.innerHTML = \`Files: \${message.value.length}\`;
              }
            });

          </script>
        </body>
      </html>
    `;

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === 'question') { this._showQuestion(message.text); }
      if (message.command === 'setFilesToInclude') { this._filesToIncludeState.setValue(message.value); }
      if (message.command === 'setFilesToExclude') { this._filesToExcludeState.setValue(message.value); }
    });

    this._filesState.subscribe((files) => {
      console.log(files);
      webviewView.webview.postMessage({
        command: 'setFiles',
        value: files,
      });
    });
  }

  private _showQuestion(question: string) {
    vscode.window.showInformationMessage('Question: ' + question);
  }

  // private async _findFiles(include: string, exclude: string) {
  //   // TODO: use gitignore to search not all directories
  //   const gitignoreFiles = await vscode.workspace.findFiles('**/.gitignore');
  //   // TODO: detect encoding
  //   const textDecoder = new TextDecoder('utf-8');
  //   const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.toString() ?? '';
  //   const ignore = (await Promise.all(
  //     gitignoreFiles.map(async (file) => {
  //       const data = await vscode.workspace.fs.readFile(file);
  //       const lines = textDecoder.decode(data).split(/\r?\n/);
  //       const dir = file.with({ path: file.path.substring(0, file.path.lastIndexOf('/')) }).toString();

  //       return lines
  //         .map((line) => line.trim())
  //         .filter((line) => line.length > 0)
  //         .filter((line) => !line.startsWith('#'))
  //         // TODO: maybe support !/foo/bar
  //         .filter((line) => !line.startsWith('!'))
  //         .map((line) => `${dir}/${line}`.replace(workspaceFolder, ''))
  //         .map((line) => line.replace(/\\/g, '/'));
  //     })
  //   ))
  //     .flat()
  //     .join(',');
  //   const gitignore = '**/.gitignore';

  //   console.log({ include, exclude, ignore, gitignore });
    
  //   vscode.workspace.findFiles(`{${include}}`, `{${exclude},${ignore},${gitignore}}`).then((files) => {
  //     vscode.window.showInformationMessage('Files: ' + files.length);
  //   });
  // }
}

const FILES_TO_INCLUDE_KEY = 'gpt-with-context.filesToInclude';
const FILES_TO_EXCLUDE_KEY = 'gpt-with-context.filesToExclude';

export const activate = (context: vscode.ExtensionContext) => {
  console.log('GPT with Context extension activated');

  const filesToIncludeState = new PersistentState<string>(context, FILES_TO_INCLUDE_KEY, '');
  const filesToExcludeState = new PersistentState<string>(context, FILES_TO_EXCLUDE_KEY, '');
  const filesState = new NonPersistentState<vscode.Uri[]>([]);

  const searchViewProvider = new GPTWithContextViewProvider(context, filesToIncludeState, filesToExcludeState, filesState);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gpt-with-context.MainView', searchViewProvider)
  );

  filesToIncludeState.subscribe(async () => {
    const filesToInclude = filesToIncludeState.getValue();
    const filesToExclude = filesToExcludeState.getValue();
    const files = await findFiles(filesToInclude, filesToExclude);
    filesState.setValue(files);
  });
  filesToExcludeState.subscribe(async () => {
    const filesToInclude = filesToIncludeState.getValue();
    const filesToExclude = filesToExcludeState.getValue();
    const files = await findFiles(filesToInclude, filesToExclude);
    filesState.setValue(files);
  });

  // TODO: remove
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

const findFiles = async (include: string, exclude: string) => {
  // TODO: use gitignore to search not all directories
  const gitignoreFiles = await vscode.workspace.findFiles('**/.gitignore');
  // TODO: detect encoding
  const textDecoder = new TextDecoder('utf-8');
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.toString() ?? '';
  const ignore = (await Promise.all(
    gitignoreFiles.map(async (file) => {
      const data = await vscode.workspace.fs.readFile(file);
      const lines = textDecoder.decode(data).split(/\r?\n/);
      const dir = file.with({ path: file.path.substring(0, file.path.lastIndexOf('/')) }).toString();

      return lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => !line.startsWith('#'))
        // TODO: maybe support !/foo/bar
        .filter((line) => !line.startsWith('!'))
        .map((line) => `${dir}/${line}`.replace(workspaceFolder, ''))
        .map((line) => line.replace(/\\/g, '/'));
    })
  ))
    .flat()
    .join(',');
  const gitignore = '**/.gitignore';

  return await vscode.workspace.findFiles(`{${include}}`, `{${exclude},${ignore},${gitignore}}`);
};