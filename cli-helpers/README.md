# bods-integrated-data-helpers

CLI helpers for local development and testing.

## Usage

Run a command:

```bash
pnpm command <command>

# for example:
pnpm command invoke-noc-retriever

# with flags:
pnpm command invoke-noc-retriever --stage="local"

# alternatively:
pnpm command invoke-noc-retriever --stage "local"
```

## Commands

See `src/commands/index.ts` for a list of supported commands.
