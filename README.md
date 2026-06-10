# alias-man

An interactive terminal UI for managing your zsh aliases on macOS — browse, search, add, edit, delete, and consolidate aliases without ever hand-editing your `.zshrc` again.

```
╭──────────────────────────────────────────────────────────────╮
│ alias-man                                          4 managed │
│ Search: git                                                  │
│                                                              │
│ ▸ gco           git checkout                                 │
│   gp            git pull --rebase                            │
│   gs            git status                                   │
│   lg            git log --oneline -20      [.zshrc]          │
│                                                              │
│ [a]dd  [e]dit  [d]elete  [i]mport  [/] search  [q]uit        │
╰──────────────────────────────────────────────────────────────╯
```

## Why

Aliases tend to accumulate as one-off lines scattered across `.zshrc`, `.zshenv`, and whatever dotfiles you've copied between machines over the years. Finding one means grepping; renaming one means hoping you edited the right file. alias-man gives them a single home and a UI:

- **One source of truth** — aliases live in `~/.config/alias-man/aliases.zsh`, a plain zsh file. No database, no lock-in: if you delete the app tomorrow, your aliases still work.
- **Sees your whole setup** — aliases defined elsewhere in your rc files show up too, tagged with where they came from, and can be imported into the managed file with one keypress.
- **Safe by construction** — commands are quoted with proper zsh escaping (`'\''`), file writes are atomic, and any rc file alias-man modifies is backed up first.

## Installation

Requires Node.js ≥ 20.

```sh
git clone <repo-url> && cd alias-man
npm install
npm run build
npm link        # puts `alias-man` on your PATH
```

On first launch, alias-man appends a single, clearly-commented `source` line to your `~/.zshrc` so every new shell loads your managed aliases:

```sh
# Added by alias-man — loads your managed aliases
[ -f "$HOME/.config/alias-man/aliases.zsh" ] && source "$HOME/.config/alias-man/aliases.zsh"
```

That is the only change it ever makes to your `.zshrc` unprompted.

## Usage

```sh
alias-man          # launch the TUI
alias-man --list   # print all aliases (managed + found in rc files)
alias-man --help
```

### Keys

| Key | Action |
| --- | --- |
| `↑` `↓` / `j` `k` | move selection |
| `a` | add a new alias |
| `e` / `Enter` | edit the selected alias |
| `d` | delete the selected alias (asks for confirmation) |
| `i` | import an rc-file alias into the managed file |
| `/` | filter the list — `Enter` keeps the filter, `Esc` clears it |
| `q` | quit |

In the add/edit form: `Enter` advances from name to command and then saves, `Tab` switches fields, `Esc` cancels.

Newly added aliases work in every new shell immediately. For a shell that's already open, run `source ~/.zshrc` once.

### Importing existing aliases

alias-man scans `~/.zshrc`, `~/.zshenv`, `~/.zprofile`, `~/.zsh_aliases`, and `~/.aliases` for alias definitions it doesn't own. These appear in the list with a yellow `[filename]` tag and are read-only until imported. Pressing `i`:

1. Backs up the rc file to `<file>.alias-man.bak` (once, preserving the original).
2. Comments out the original line in place: `# moved to alias-man: alias lg='...'`.
3. Adds the alias to the managed file.

Nothing is ever silently deleted from your dotfiles.

## How it works

```
~/.zshrc ──source──▶ ~/.config/alias-man/aliases.zsh ◀──reads/writes── alias-man TUI
    ▲                                                                      │
    └────────────────── scanned for external aliases ──────────────────────┘
```

The managed file is rewritten on every save: aliases are sorted by name, serialized as single-quoted zsh (`alias gs='git status'`), and written atomically (temp file + rename) so a crash can't leave it half-written.

The parser handles single-quoted values (including the `'\''` escape), double-quoted values with backslash escapes, and bare words. It deliberately **skips** rather than mangles anything it can't represent faithfully: global and suffix aliases (`alias -g`, `alias -s`) and multiple aliases declared on one line.

## Project structure

```
src/
  cli.tsx    entry point — arg parsing (--list, --help), shell hook setup, renders the TUI
  app.tsx    the Ink UI — list, search, add/edit form, delete confirmation
  store.ts   all file I/O — parse/serialize aliases, managed file, rc scanning, imports
test/
  store.test.ts   parser/serializer unit tests (quoting round-trips, edge cases)
```

Built with [Ink](https://github.com/vadimdemedes/ink) (React for the terminal) and TypeScript. The UI layer never touches the filesystem directly — everything goes through `store.ts`, so the storage logic is testable and reusable (e.g. for a future non-TUI frontend).

## Development

```sh
npm run dev      # run the TUI from source (tsx, no build step)
npm test         # unit tests
npm run build    # compile to dist/
```

## Roadmap ideas

- Enable/disable toggle (comment an alias out without deleting it)
- Descriptions or tags per alias
- bash support
- Detect alias name collisions with installed binaries

## License

MIT
