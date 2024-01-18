import * as vscode from 'vscode';

export class State<T> {
  private readonly onChangeEmitter = new vscode.EventEmitter<T>();

  public constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _key: string,
    private readonly _initialValue: T
  ) {}

  public getValue(): T {
    return this._context.workspaceState.get<T>(this._key, this._initialValue);
  }

  public async setValue(value: T): Promise<void> {
    if (this.getValue() === value) { return; }
    await this._context.workspaceState.update(this._key, value);
    this.onChangeEmitter.fire(value);
  }

  public subscribe(callback: (value: T) => void): vscode.Disposable {
    return this.onChangeEmitter.event(callback);
  }

  public unsubscribe(disposable: vscode.Disposable): void {
    disposable.dispose();
  }
}
