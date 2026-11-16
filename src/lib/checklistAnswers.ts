export function splitChecklistAnswer(raw: string, choices: string[] = []): string[] {
  const value = raw.trim();
  if (!value) return [];
  const options = [...new Set(choices.map(c => c.trim()).filter(Boolean))].sort((a,b) => b.length-a.length);
  const memo = new Map<string, string[] | null>();
  const parse = (rest: string): string[] | null => {
    if (!rest) return [];
    if (memo.has(rest)) return memo.get(rest)!;
    for (const option of options) {
      if (rest === option) return [option];
      if (!rest.startsWith(option)) continue;
      const tail = rest.slice(option.length).trimStart();
      if (!/^[,;]/.test(tail)) continue;
      const suffix = parse(tail.slice(1).trimStart());
      if (suffix) return [option, ...suffix];
    }
    memo.set(rest, null);
    return null;
  };
  return parse(value) ?? value.split(value.includes(';') ? ';' : ',').map(v => v.trim()).filter(Boolean);
}
