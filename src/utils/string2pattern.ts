export const string2pattern = (string: string) => {
  return string
    .split(',')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      if (line.startsWith('**/')) { return line; }
      return `**/${line}`;
    })
    .flatMap((line) => [line, line.endsWith('/') ? `${line}**` : `${line}/**`]);
};
