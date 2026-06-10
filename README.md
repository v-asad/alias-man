# alias-man

An interactive terminal UI for managing your zsh aliases.

```
╭──────────────────────────────────────────────────────────────╮
│ alias-man                                          2 managed │
│ Search: co                                                   │
│                                                              │
│ ▸ gco           git checkout                                 │
│                                                              │
│ [a]dd  [e]dit  [d]elete  [i]mport  [/] search  [q]uit        │
╰──────────────────────────────────────────────────────────────╯
```

## Usage

```sh
alias-man          # launch the TUI
alias-man --list   # print all aliases
alias-man --help
```

### Keys

| Key | Action |
| --- | --- |
| `a` | add a new alias |
| `e` / `Enter` | edit the selected alias |
| `d` | delete (asks for confirmation) |
| `i` | import an alias found in an rc file into alias-man |
| `/` | filter the list; `Enter` keeps the filter, `Esc` clears it |
| `↑↓` / `jk` | move selection |
| `q` | quit |

## How it works

- Managed aliases live in `~/.config/alias-man/aliases.zsh` — a plain zsh
  file, so it works even if you stop using the app.
- On first launch, alias-man appends one `source` line to your `~/.zshrc`
  so every new shell loads the managed file.
- It also scans `~/.zshrc`, `~/.zshenv`, `~/.zprofile`, `~/.zsh_aliases`,
  and `~/.aliases` for aliases defined elsewhere and shows them with a
  yellow tag. Press `i` to take one over: it's added to the managed file
  and the original line is commented out (a one-time backup of the rc file
  is kept at `<file>.alias-man.bak`).
- New aliases are available in new shells immediately; in an already-open
  shell, run `source ~/.zshrc`.

Out of scope (for now): global/suffix aliases (`alias -g`, `alias -s`) and
multiple aliases declared on one line — these are detected but skipped.

## Development

```sh
npm run dev      # run the TUI from source
npm test         # parser/serializer unit tests
npm run build    # compile to dist/
npm link         # make the alias-man command available globally
```
