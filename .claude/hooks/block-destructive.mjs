// PreToolUse (Bash) guard: refuses destructive shell commands before they run.
// Exit 2 + stderr blocks the call and tells Claude why; anything else lets it through.
const BLOCKED = [
  [/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b/, 'rm -rf'],
  [/\bRemove-Item\b[^|;]*-Recurse\b[^|;]*-Force\b/i, 'Remove-Item -Recurse -Force'],
  [/\bgit\s+push\b[^|;&]*\s(--force(-with-lease)?|-f)\b/, 'git push --force'],
  [/\beas\s+submit\b/, 'eas submit'],
];

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let command;
  try {
    command = String(JSON.parse(raw)?.tool_input?.command ?? '');
  } catch {
    process.exit(0);
  }
  const hit = BLOCKED.find(([re]) => re.test(command));
  if (hit) {
    process.stderr.write(
      `Blocked by .claude/hooks/block-destructive.mjs: "${hit[1]}" is not allowed in this repo. ` +
        'Ask the Author to run it by hand if it is really needed.\n',
    );
    process.exit(2);
  }
  process.exit(0);
});
