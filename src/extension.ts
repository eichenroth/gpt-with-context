import * as vscode from 'vscode';
import { NonPersistentState, PersistentState, State } from './State';
import { gitignore2glob } from './gitignore2glob';

type FileMeta = { file: vscode.Uri; locCount: number; charCount: number; };

class GPTWithContextSearchViewProvider implements vscode.WebviewViewProvider {
  constructor(
		private readonly _context: vscode.ExtensionContext,
    private readonly _filesToIncludeState: State<string>,
    private readonly _filesToExcludeState: State<string>,
    private readonly _filesState: State<vscode.Uri[]>,
    private readonly _filesMetasState: State<FileMeta[]>,
    private readonly _search: () => void,
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
      <html style="height:100%;">
        <head>
          <script src="${scriptUri}"></script>
        </head>
        <body style="height:100%;margin:0;padding:0;">
          <div style="display:flex;flex-direction:column;align-items:flex-start;height:100%;">

            <div style="flex-grow:1;padding-left:20px;padding-right:20px;padding-top:0px;padding-bottom:16px;">
              <div id="welcome">
                <p>Welcome to GPT with Context!</p>
                <p>Utilize the full 128k context power by sending all your files to GPT.</p>
              </div>
              <div id="chat"></div>
            </div>

            <div style="padding-left:20px;padding-right:20px;padding-top:8px;padding-bottom:8px;width:100%;box-sizing:border-box;">
              <div>
                <vscode-text-field
                  id="question_field"
                  placeholder="Ask me anything..."
                  autofocus
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
                <span id="file_count">0</span> files,
                <span id="loc_count">0</span> loc,
                <span id="char_count">0</span> chars
              </div>
            </div>
          </div>

          <script>
            const vscode = acquireVsCodeApi();
            const questionField = document.getElementById('question_field');
            const filesToIncludeField = document.getElementById('files_to_include_field');
            const filesToExcludeField = document.getElementById('files_to_exclude_field');

            const fileCountDisplay = document.getElementById('file_count');
            const locCountDisplay = document.getElementById('loc_count');
            const charCountDisplay = document.getElementById('char_count');

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
            filesToIncludeField.addEventListener('keyup', (event) => {
              if (event.key !== 'Enter') { return; }
              if (event.shiftKey) { return; }
              vscode.postMessage({ command: 'triggerSearch' });
              event.preventDefault();
            });
            filesToExcludeField.addEventListener('input', (event) => {
              vscode.postMessage({
                command: 'setFilesToExclude',
                value: filesToExcludeField.value,
              });
            });
            filesToExcludeField.addEventListener('keyup', (event) => {
              if (event.key !== 'Enter') { return; }
              if (event.shiftKey) { return; }
              vscode.postMessage({ command: 'triggerSearch' });
              event.preventDefault();
            });

            window.addEventListener('message', (event) => {
              const message = event.data;
              if (message.command === 'setFiles') {
                fileCountDisplay.innerHTML = message.value.length.toString();
              }
              if (message.command === 'setFilesMetas') {
                locCountDisplay.innerHTML = message.value.reduce((sum, fileMeta) => sum + fileMeta.locCount, 0).toString();
                charCountDisplay.innerHTML = message.value.reduce((sum, fileMeta) => sum + fileMeta.charCount, 0).toString();
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
      if (message.command === 'triggerSearch') { this._search(); }
    });

    this._filesState.subscribe((files) => {
      webviewView.webview.postMessage({ command: 'setFiles', value: files });
    });
    this._filesMetasState.subscribe((filesMetas) => {
      webviewView.webview.postMessage({ command: 'setFilesMetas', value: filesMetas });
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
    private readonly _fileMetasState: State<FileMeta[]>,
  ) {
    this._fileMetasState.subscribe(() => this._onDidChangeTreeData.fire(undefined));
  }

  getTreeItem(element: vscode.TreeItem) { return element; }
	getChildren(element?: vscode.TreeItem) {
		if (element) { return []; }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.path ?? '';
    return this._fileMetasState.getValue()
      .map((fileMeta) => {
        const treeItem = new vscode.TreeItem(fileMeta.file.path.replace(workspaceFolder, ''));
        treeItem.resourceUri = fileMeta.file;
        treeItem.command = {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [vscode.Uri.file(fileMeta.file.path)],
        };
        treeItem.description = `${fileMeta.locCount} loc, ${fileMeta.charCount} chars`;
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
  const filesMetasState = new NonPersistentState<FileMeta[]>([]);

  const search = async () => {
    const filesToInclude = filesToIncludeState.getValue();
    const filesToExclude = filesToExcludeState.getValue();
    filesState.setValue(await findFiles(filesToInclude, filesToExclude));
  };

  const searchViewProvider = new GPTWithContextSearchViewProvider(
    context, filesToIncludeState, filesToExcludeState, filesState, filesMetasState, search,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gpt-with-context.MainView', searchViewProvider)
  );

  const resultViewProvider = new GPTWithContextResultTreeDataProvidery(filesMetasState);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('gpt-with-context.ResultView', resultViewProvider)
  );

  filesToIncludeState.subscribe(search);
  filesToExcludeState.subscribe(search);

  filesState.subscribe(async (files) => { filesMetasState.setValue(await getFileMetas(files)); });

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

const findFiles = async (include: string, exclude: string): Promise<vscode.Uri[]> => {
  console.info('finding files', {include, exclude});
  
  // TODO: use all gitignore files with '**/.gitinore'
  const ignoreFiles = await vscode.workspace.findFiles('.gitignore');
  let ignore = '';
  if (ignoreFiles.length > 0) {
    const ignoreContent = (await vscode.workspace.fs.readFile(ignoreFiles[0])).toString();
    ignore = gitignore2glob(ignoreContent).join(',');
  }
  console.info('ignore from gitignore', { ignore });

  const extraIgnore = '**/.gitignore,**/.git/**';
  const files = await vscode.workspace.findFiles(`{${include}}`, `{${exclude},${ignore},${extraIgnore}}`);
  return files;
};

const getFileMetas = async (files: vscode.Uri[]): Promise<FileMeta[]> => {
  return await Promise.all(
    files.map(async (file) => {
      const content = (await vscode.workspace.fs.readFile(file)).toString();
      const locCount = content.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0).length;
      const charCount = content.length;
      return { file, locCount, charCount };
    }
  ));
};
