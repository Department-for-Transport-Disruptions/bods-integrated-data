# bods-integrated-data-helpers

CLI helpers for local development and testing.

## Usage

Run a command by using the command's filename:

```bash
pnpm command {command-name}

# for example:
pnpm command invoke-noc-retriever

# with flags:
pnpm command invoke-noc-retriever --stage="local"

# alternatively:
pnpm command invoke-noc-retriever --stage "local"
```

## Commands

See `src/commands` for a list of supported commands.
