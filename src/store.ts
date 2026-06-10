import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface AliasEntry {
  name: string;
  command: string;
  /** 'managed' for aliases owned by alias-man, otherwise the rc file path it was found in */
  source: string;
}

export const CONFIG_DIR = path.join(os.homedir(), '.config', 'alias-man');
export const ALIASES_FILE = path.join(CONFIG_DIR, 'aliases.zsh');

const HOOK_MARKER = '.config/alias-man/aliases.zsh';
const HOOK =
  '\n# Added by alias-man — loads your managed aliases\n' +
  `[ -f "$HOME/${HOOK_MARKER}" ] && source "$HOME/${HOOK_MARKER}"\n`;

const HEADER =
  '# Managed by alias-man. This file is rewritten when you save from the app.\n';

const RC_FILES = ['.zshrc', '.zshenv', '.zprofile', '.zsh_aliases', '.aliases'];

/**
 * Parse a zsh single-quoted value starting at s[0] === "'".
 * Handles the '\'' escape sequence. Returns null if the remainder of the
 * line is anything other than whitespace or a comment (e.g. a second alias
 * on the same line), which we deliberately don't support.
 */
function parseSingleQuoted(s: string): string | null {
  let out = '';
  let i = 1;
  let closed = false;
  while (i < s.length) {
    if (s[i] === "'") {
      if (s.slice(i, i + 4) === "'\\''") {
        out += "'";
        i += 4;
      } else {
        i++;
        closed = true;
        break;
      }
    } else {
      out += s[i++];
    }
  }
  if (!closed) return null;
  const rest = s.slice(i).trim();
  if (rest && !rest.startsWith('#')) return null;
  return out;
}

/** Parse one line of shell into {name, command} if it's a simple alias definition. */
export function parseAliasLine(line: string): { name: string; command: string } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('alias ')) return null;
  const body = trimmed.slice('alias '.length).trim();
  if (body.startsWith('-')) return null; // alias -g / -s etc. — out of scope

  const eq = body.indexOf('=');
  if (eq <= 0) return null;
  const name = body.slice(0, eq);
  if (!/^[A-Za-z0-9_.,:@%+-]+$/.test(name)) return null;

  const value = body.slice(eq + 1);
  if (value.startsWith("'")) {
    const command = parseSingleQuoted(value);
    return command === null ? null : { name, command };
  }
  if (value.startsWith('"')) {
    const m = value.match(/^"((?:[^"\\]|\\.)*)"\s*(#.*)?$/);
    if (!m) return null;
    return { name, command: m[1].replace(/\\(.)/g, '$1') };
  }
  const m = value.match(/^(\S+)\s*(#.*)?$/);
  return m ? { name, command: m[1] } : null;
}

/** Render an alias as a zsh line, single-quoting the command safely. */
export function serializeAlias(name: string, command: string): string {
  return `alias ${name}='${command.split("'").join("'\\''")}'`;
}

export function isValidAliasName(name: string): boolean {
  return /^[A-Za-z0-9_.,:@%+-]+$/.test(name);
}

function atomicWrite(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

export function loadManaged(): AliasEntry[] {
  if (!fs.existsSync(ALIASES_FILE)) return [];
  const entries: AliasEntry[] = [];
  for (const line of fs.readFileSync(ALIASES_FILE, 'utf8').split('\n')) {
    const parsed = parseAliasLine(line);
    if (parsed) entries.push({ ...parsed, source: 'managed' });
  }
  return entries;
}

export function saveManaged(entries: AliasEntry[]): void {
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const lines = sorted.map((e) => serializeAlias(e.name, e.command));
  atomicWrite(ALIASES_FILE, HEADER + lines.join('\n') + (lines.length ? '\n' : ''));
}

export function upsertAlias(name: string, command: string): void {
  const entries = loadManaged().filter((e) => e.name !== name);
  entries.push({ name, command, source: 'managed' });
  saveManaged(entries);
}

export function removeAlias(name: string): void {
  saveManaged(loadManaged().filter((e) => e.name !== name));
}

/** Scan the usual zsh rc files for alias definitions outside our managed file. */
export function loadExternal(): AliasEntry[] {
  const entries: AliasEntry[] = [];
  for (const rc of RC_FILES) {
    const file = path.join(os.homedir(), rc);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (line.includes(HOOK_MARKER)) continue;
      const parsed = parseAliasLine(line);
      if (parsed) entries.push({ ...parsed, source: file });
    }
  }
  return entries;
}

/**
 * Make sure ~/.zshrc sources our managed file. Appends the hook once;
 * returns true if it was added on this call.
 */
export function ensureShellHook(): boolean {
  const zshrc = path.join(os.homedir(), '.zshrc');
  const current = fs.existsSync(zshrc) ? fs.readFileSync(zshrc, 'utf8') : '';
  if (current.includes(HOOK_MARKER)) return false;
  fs.writeFileSync(zshrc, current + HOOK);
  return true;
}

/**
 * Move an external alias into the managed file. The original line is
 * commented out (not deleted); a one-time backup of the rc file is kept
 * at <file>.alias-man.bak before its first modification.
 */
export function importExternal(entry: AliasEntry): void {
  const backup = `${entry.source}.alias-man.bak`;
  if (!fs.existsSync(backup)) fs.copyFileSync(entry.source, backup);

  const lines = fs.readFileSync(entry.source, 'utf8').split('\n');
  const idx = lines.findIndex((line) => {
    const parsed = parseAliasLine(line);
    return parsed !== null && parsed.name === entry.name && parsed.command === entry.command;
  });
  if (idx !== -1) {
    lines[idx] = `# moved to alias-man: ${lines[idx].trim()}`;
    atomicWrite(entry.source, lines.join('\n'));
  }
  upsertAlias(entry.name, entry.command);
}
