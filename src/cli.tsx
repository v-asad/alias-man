#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import App from './app.js';
import { ALIASES_FILE, ensureShellHook, loadExternal, loadManaged } from './store.js';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`alias-man — manage your zsh aliases

Usage:
  alias-man          launch the interactive TUI
  alias-man --list   print all aliases (managed + found in rc files)
  alias-man --help   show this help

Managed aliases live in ${ALIASES_FILE},
which alias-man sources from your ~/.zshrc.`);
  process.exit(0);
}

if (args.includes('--list')) {
  const entries = [...loadManaged(), ...loadExternal()];
  if (entries.length === 0) {
    console.log('No aliases found.');
  } else {
    const pad = Math.max(...entries.map((e) => e.name.length)) + 2;
    for (const e of entries) {
      const tag = e.source === 'managed' ? '' : `  [${e.source.split('/').pop()}]`;
      console.log(`${e.name.padEnd(pad)}${e.command}${tag}`);
    }
  }
  process.exit(0);
}

const hookJustAdded = ensureShellHook();
render(<App hookJustAdded={hookJustAdded} />);
