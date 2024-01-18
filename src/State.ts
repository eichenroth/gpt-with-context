import * as vscode from 'vscode';

export interface State<T> {
  getValue(): T;
  setValue(value: T): void;
  subscribe(callback: (value: T) => void): vscode.Disposable;
  unsubscribe(disposable: vscode.Disposable): void;
}

export class NonPersistentState<T> implements State<T> {
  private readonly onChangeEmitter = new vscode.EventEmitter<T>();

  public constructor(private _value: T) {}

  public getValue(): T {
    return this._value;
  }

  public setValue(value: T): void {
    if (this._value === value) { return; }
    this._value = value;
    this.onChangeEmitter.fire(value);
  }

  public subscribe(callback: (value: T) => void): vscode.Disposable {
    return this.onChangeEmitter.event(callback);
  }

  public unsubscribe(disposable: vscode.Disposable): void {
    disposable.dispose();
  }
}

export class PersistentState<T> implements State<T> {
  private readonly onChangeEmitter = new vscode.EventEmitter<T>();

  public constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _key: string,
    private readonly _initialValue: T
  ) {}

  public getValue(): T {
    return this._context.workspaceState.get<T>(this._key, this._initialValue);
  }

  public setValue(value: T): void {
    if (this.getValue() === value) { return; }
    this._context.workspaceState.update(this._key, value).then(() => {
      this.onChangeEmitter.fire(value);
    });
  }

  public subscribe(callback: (value: T) => void): vscode.Disposable {
    return this.onChangeEmitter.event(callback);
  }

  public unsubscribe(disposable: vscode.Disposable): void {
    disposable.dispose();
  }
}
