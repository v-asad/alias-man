import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAliasLine, serializeAlias, isValidAliasName } from '../src/store.js';

test('parses single-quoted alias', () => {
  assert.deepEqual(parseAliasLine("alias gs='git status'"), { name: 'gs', command: 'git status' });
});

test('parses double-quoted alias with escapes', () => {
  assert.deepEqual(parseAliasLine('alias greet="echo \\"hi\\""'), { name: 'greet', command: 'echo "hi"' });
});

test('parses bare alias', () => {
  assert.deepEqual(parseAliasLine('alias ll=ls'), { name: 'll', command: 'ls' });
});

test('parses indented alias with trailing comment', () => {
  assert.deepEqual(parseAliasLine("  alias gp='git pull'  # pull"), { name: 'gp', command: 'git pull' });
});

test("handles the '\\'' escape inside single quotes", () => {
  assert.deepEqual(parseAliasLine("alias say='echo '\\''hi'\\'''"), { name: 'say', command: "echo 'hi'" });
});

test('ignores non-alias lines, flags, and multi-alias lines', () => {
  assert.equal(parseAliasLine('export PATH=/usr/bin'), null);
  assert.equal(parseAliasLine("alias -g G='| grep'"), null);
  assert.equal(parseAliasLine("alias a='x' b='y'"), null);
  assert.equal(parseAliasLine('# alias gs="git status"'), null);
});

test('serialize → parse round-trips commands with quotes', () => {
  const tricky = `echo "it's a 'test'" && git log --format='%h %s'`;
  const line = serializeAlias('x', tricky);
  assert.deepEqual(parseAliasLine(line), { name: 'x', command: tricky });
});

test('validates alias names', () => {
  assert.ok(isValidAliasName('gs'));
  assert.ok(isValidAliasName('g.s-2_x'));
  assert.ok(!isValidAliasName('bad name'));
  assert.ok(!isValidAliasName("ba'd"));
  assert.ok(!isValidAliasName('a=b'));
});
