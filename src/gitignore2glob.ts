// inspired by https://github.com/EE/gitignore-to-glob

export const gitignore2glob = (gitignore: string) => {
  return gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('#'))
    // TODO: maybe handle !/foo/bar
    .filter((line) => !line.startsWith('!'))
    .map((line) => {
      if (line.startsWith('/')) { return line.substring(1); }
      if (line.startsWith('**/')) { return line; }
      return `**/${line}`;
    })
    .flatMap((line) => [line, line.endsWith('/') ? `${line}**` : `${line}/**`]);
};
