import * as vscode from 'vscode';
import { simpleGit } from 'simple-git';
import { NonPersistentState, PersistentState, State } from './State';

class GPTWithContextSearchViewProvider implements vscode.WebviewViewProvider {
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

          <div style="margin-top:2px">
            <vscode-text-field
              id="files_to_include_field"
              placeholder="e.g. *.ts, src/**/include"
              value="${filesToInclude}"
              style="width:100%;"
            >
              <span style="font-size:0.8em;">files to include</span>
            </vscode-text-field>
            <vscode-text-field
              id="files_to_exclude_field"
              placeholder="e.g. *.ts, src/**/exclude"
              value="${filesToExclude}"
              style="width:100%;"
            >
              <span style="font-size:0.8em;">files to exclude</span>
            </vscode-text-field>
          </div>

          <div style="margin-top:4px">
            <span id="file_count">0</span> files
          </div>
          

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
                fileCount.innerHTML = message.value.length.toString();
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
      webviewView.webview.postMessage({
        command: 'setFiles',
        value: files,
      });
    });
  }

  private _showQuestion(question: string) {
    vscode.window.showInformationMessage('Question: ' + question);
  }
}

class GPTWithContextResultTreeDataProvidery implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly _filesState: State<vscode.Uri[]>,
  ) {
    this._filesState.subscribe(() => this._onDidChangeTreeData.fire(undefined));
  }

  getTreeItem(element: vscode.TreeItem) { return element; }
	getChildren(element?: vscode.TreeItem) {
		if (element) { return []; }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.path ?? '';
    return this._filesState.getValue()
      .map((file) => file.path)
      .map((path) => path.replace(workspaceFolder, ''))
      .map((path) => {
        const treeItem = new vscode.TreeItem(path);
        return treeItem;
      });
	}
}

const FILES_TO_INCLUDE_KEY = 'gpt-with-context.filesToInclude';
const FILES_TO_EXCLUDE_KEY = 'gpt-with-context.filesToExclude';

export const activate = (context: vscode.ExtensionContext) => {
  console.log('GPT with Context extension activated');

  const filesToIncludeState = new PersistentState<string>(context, FILES_TO_INCLUDE_KEY, '');
  const filesToExcludeState = new PersistentState<string>(context, FILES_TO_EXCLUDE_KEY, '');
  const filesState = new NonPersistentState<vscode.Uri[]>([]);

  const searchViewProvider = new GPTWithContextSearchViewProvider(context, filesToIncludeState, filesToExcludeState, filesState);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gpt-with-context.MainView', searchViewProvider)
  );

  const resultViewProvider = new GPTWithContextResultTreeDataProvidery(filesState);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('gpt-with-context.ResultView', resultViewProvider)
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
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.path ?? '';

  const git = simpleGit({
    baseDir: workspaceFolder,
    maxConcurrentProcesses: 6,
  });

  const extraIgnore = '**/.gitignore,**/.git/**';

  const files = await vscode.workspace.findFiles(`{${include}}`, `{${exclude},${extraIgnore}}`);
  const filteredFiles = (await Promise.all(files.map(async (file) => {
    const keepFile = await new Promise<boolean>((resolve, reject) => {
      git.checkIgnore(file.path, (error, ignored) => {
        if (error) { reject(error); }
        resolve(ignored.length === 0);
      });
    });
    if (keepFile) { return file; }
  }))).filter((file): file is vscode.Uri => file !== undefined);

  return filteredFiles;
};