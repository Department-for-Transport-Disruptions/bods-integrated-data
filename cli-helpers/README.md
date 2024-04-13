# bods-integrated-data-helpers

<!-- toc -->

- [Usage](#usage)
- [Commands](#commands)

<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ pnpm install && pnpm run build
$ ./bin/run.js COMMAND
running command...
$ ./bin/run.js (--version)
@bods-integrated-data/cli-helpers/0.0.0 darwin-arm64 node-v18.15.0
$ ./bin/run.js --help [COMMAND]
USAGE
  $ ./bin/run.js COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`create-avl-mock-data-producer`](#create-avl-mock-data-producer)

## `create-avl-mock-data-producer`

Create AVL mock data producer and subscribe to its data feed

```
USAGE
  $ ./bin/run.js create-avl-mock-data-producer --name <value> --stage <value>

FLAGS
  --name=<value>            (required) Name of mock data producer
  --stage=<value>           (required) Stage to use

DESCRIPTION
  Create AVL mock data producer and subscribe to its data feed
```
