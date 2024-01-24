(async () => {
  const toolkit = await import('@vscode/webview-ui-toolkit');
  toolkit.provideVSCodeDesignSystem().register(toolkit.vsCodeTextField());
  toolkit.provideVSCodeDesignSystem().register(toolkit.vsCodeTextArea());
})();
