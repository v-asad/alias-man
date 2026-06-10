import React, { useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import {
  AliasEntry,
  importExternal,
  isValidAliasName,
  loadExternal,
  loadManaged,
  removeAlias,
  upsertAlias,
} from './store.js';

type Mode = 'list' | 'search' | 'form' | 'confirm-delete';

const VISIBLE_ROWS = 12;

function InputValue({ value, placeholder, focused }: { value: string; placeholder: string; focused: boolean }) {
  return (
    <Text>
      {value ? <Text>{value}</Text> : <Text dimColor>{placeholder}</Text>}
      {focused && <Text inverse> </Text>}
    </Text>
  );
}

export default function App({ hookJustAdded }: { hookJustAdded: boolean }) {
  const { exit } = useApp();

  const [managed, setManaged] = useState<AliasEntry[]>(loadManaged);
  const [external, setExternal] = useState<AliasEntry[]>(loadExternal);
  const [mode, setMode] = useState<Mode>('list');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState(
    hookJustAdded ? 'Hooked into ~/.zshrc — new shells will load your aliases.' : '',
  );

  // Form state
  const [editing, setEditing] = useState<AliasEntry | null>(null);
  const [formName, setFormName] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formField, setFormField] = useState<'name' | 'command'>('name');

  const reload = () => {
    setManaged(loadManaged());
    setExternal(loadExternal());
  };

  const all = useMemo(() => {
    const sortByName = (a: AliasEntry, b: AliasEntry) => a.name.localeCompare(b.name);
    return [...[...managed].sort(sortByName), ...[...external].sort(sortByName)];
  }, [managed, external]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return all;
    return all.filter((e) => e.name.toLowerCase().includes(q) || e.command.toLowerCase().includes(q));
  }, [all, query]);

  const cursor = Math.min(selected, Math.max(0, filtered.length - 1));
  const current: AliasEntry | undefined = filtered[cursor];

  const openForm = (entry: AliasEntry | null) => {
    setEditing(entry);
    setFormName(entry?.name ?? '');
    setFormCommand(entry?.command ?? '');
    setFormField(entry ? 'command' : 'name');
    setStatus('');
    setMode('form');
  };

  const saveForm = () => {
    const name = formName.trim();
    const command = formCommand.trim();
    if (!name || !command) {
      setStatus('Both name and command are required.');
      return;
    }
    if (!isValidAliasName(name)) {
      setStatus('Alias names can’t contain spaces, quotes, or "=".');
      return;
    }
    const renamed = editing && editing.name !== name;
    if (renamed) removeAlias(editing!.name);
    const overwriting = !editing && managed.some((e) => e.name === name);
    upsertAlias(name, command);
    reload();
    setMode('list');
    setStatus(
      `${overwriting ? 'Updated' : editing ? 'Saved' : 'Added'} ${name} ✓  (run \`source ~/.zshrc\` to use it in this shell)`,
    );
  };

  useInput((input, key) => {
    if (mode === 'list') {
      if (input === 'q') return exit();
      if (key.upArrow || input === 'k') return setSelected(Math.max(0, cursor - 1));
      if (key.downArrow || input === 'j') return setSelected(Math.min(filtered.length - 1, cursor + 1));
      if (input === '/') {
        setStatus('');
        return setMode('search');
      }
      if (input === 'a') return openForm(null);
      if (input === 'e' || key.return) {
        if (!current) return;
        if (current.source !== 'managed') return setStatus('This alias lives in your rc file — press [i] to import it first.');
        return openForm(current);
      }
      if (input === 'd') {
        if (!current) return;
        if (current.source !== 'managed') return setStatus('This alias lives in your rc file — press [i] to import it first.');
        setStatus('');
        return setMode('confirm-delete');
      }
      if (input === 'i') {
        if (!current || current.source === 'managed') return;
        importExternal(current);
        reload();
        return setStatus(`Imported ${current.name} ✓  (original line commented out, backup saved)`);
      }
      if (key.escape && query) {
        setQuery('');
        return setSelected(0);
      }
      return;
    }

    // Some terminals (and pasted text) deliver Enter as a bare "\n".
    const isReturn = key.return || input === '\n';
    const clean = (s: string) => s.replace(/[\r\n]/g, '');

    if (mode === 'search') {
      if (key.escape) {
        setQuery('');
        setSelected(0);
        return setMode('list');
      }
      if (isReturn) return setMode('list');
      if (key.upArrow) return setSelected(Math.max(0, cursor - 1));
      if (key.downArrow) return setSelected(Math.min(filtered.length - 1, cursor + 1));
      if (key.backspace || key.delete) {
        setSelected(0);
        return setQuery(query.slice(0, -1));
      }
      if (input && !key.ctrl && !key.meta) {
        setSelected(0);
        setQuery(query + clean(input));
      }
      return;
    }

    if (mode === 'form') {
      if (key.escape) {
        setStatus('');
        return setMode('list');
      }
      if (key.tab) return setFormField(formField === 'name' ? 'command' : 'name');
      if (isReturn) {
        if (formField === 'name') return setFormField('command');
        return saveForm();
      }
      const set = formField === 'name' ? setFormName : setFormCommand;
      const value = formField === 'name' ? formName : formCommand;
      if (key.backspace || key.delete) return set(value.slice(0, -1));
      if (input && !key.ctrl && !key.meta) set(value + clean(input));
      return;
    }

    if (mode === 'confirm-delete') {
      if (input === 'y' && current) {
        removeAlias(current.name);
        reload();
        setStatus(`Deleted ${current.name}`);
      }
      setMode('list');
    }
  });

  // Keep the cursor visible in a window of VISIBLE_ROWS rows.
  const windowStart = Math.max(0, Math.min(cursor - VISIBLE_ROWS + 2, filtered.length - VISIBLE_ROWS));
  const visible = filtered.slice(windowStart, windowStart + VISIBLE_ROWS);

  const hints: Record<Mode, string> = {
    list: '[a]dd  [e]dit  [d]elete  [i]mport  [/] search  [q]uit',
    search: 'type to filter · enter: done · esc: clear',
    form: 'enter: next/save · tab: switch field · esc: cancel',
    'confirm-delete': '',
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={64}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">
          alias-man
        </Text>
        <Text dimColor>
          {managed.length} managed{external.length ? ` · ${external.length} in rc files` : ''}
        </Text>
      </Box>

      <Box>
        <Text dimColor>Search: </Text>
        <InputValue value={query} placeholder={mode === 'search' ? '' : 'press / to search'} focused={mode === 'search'} />
      </Box>

      <Box flexDirection="column" marginTop={1} minHeight={Math.min(VISIBLE_ROWS, Math.max(filtered.length, 1))}>
        {filtered.length === 0 ? (
          <Text dimColor>{all.length === 0 ? 'No aliases yet — press [a] to add your first one.' : 'No matches.'}</Text>
        ) : (
          visible.map((e, i) => {
            const isCursor = windowStart + i === cursor;
            return (
              <Box key={`${e.source}:${e.name}`}>
                <Text color={isCursor ? 'cyan' : undefined}>{isCursor ? '▸ ' : '  '}</Text>
                <Box width={14}>
                  <Text bold={isCursor} color={isCursor ? 'cyan' : undefined} wrap="truncate">
                    {e.name}
                  </Text>
                </Box>
                <Box flexGrow={1}>
                  <Text wrap="truncate" dimColor={!isCursor}>
                    {e.command}
                  </Text>
                </Box>
                {e.source !== 'managed' && (
                  <Text color="yellow" dimColor>
                    {' '}
                    [{e.source.split('/').pop()}]
                  </Text>
                )}
              </Box>
            );
          })
        )}
      </Box>

      {mode === 'form' && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text bold>{editing ? `Edit ${editing.name}` : 'New alias'}</Text>
          <Box>
            <Box width={10}>
              <Text color={formField === 'name' ? 'cyan' : undefined}>Name:</Text>
            </Box>
            <InputValue value={formName} placeholder="gs" focused={formField === 'name'} />
          </Box>
          <Box>
            <Box width={10}>
              <Text color={formField === 'command' ? 'cyan' : undefined}>Command:</Text>
            </Box>
            <InputValue value={formCommand} placeholder="git status" focused={formField === 'command'} />
          </Box>
        </Box>
      )}

      {mode === 'confirm-delete' && current && (
        <Box marginTop={1}>
          <Text color="red">Delete {current.name}? [y/n]</Text>
        </Box>
      )}

      {status !== '' && (
        <Box marginTop={1}>
          <Text color="green" wrap="truncate-end">
            {status}
          </Text>
        </Box>
      )}

      {hints[mode] !== '' && (
        <Box marginTop={1}>
          <Text dimColor>{hints[mode]}</Text>
        </Box>
      )}
    </Box>
  );
}
