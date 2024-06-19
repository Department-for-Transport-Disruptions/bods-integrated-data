# Contributing

When contributing to this repository, please first discuss the change you wish to make via issue, email, or any other method with the owners of this repository before making a change.

Please note we have a [code of conduct](./CODE_OF_CONDUCT.md), please follow it in all of your interactions with the project.

## Writing code

1. Follow the [README](./README.md) for details on running code locally
1. Create a feature branch off `main` or create a fork if you do not have suitable permissions to push to the repo
   1. The branch name should be of the form `<type>/<description>` where type is a Conventional Commit type (see below), eg. `docs/update_readme`
1. Develop the feature
   1. Ensure all code is formatted correctly using the appropriate formatter (biome for TypeScript, terraform fmt for terraform etc.)
   1. Code should have sufficient test coverage, we do not enforce a test coverage percentage but all key logic should be thoroughly tested
1. Create a PR against the `main` branch

## Pull Request Process

1. After creating a Pull Request, a GitHub Actions pipeline will trigger which will run all of the tests and linting, as well as running a terraform plan against the `dev` environment, the result of this plan will be saved as a comment on the PR
1. Your code and the terraform plan will be reviewed and tested by a maintainer
   1. Any suggested changes or questions will be left as comments on the PR
1. When the maintainer is happy with the PR then they will approve it, this will trigger a terraform apply against the dev environment to ensure the apply is successful before merging into main, if the apply fails then the necessary fixes will need to be pushed before the PR can be merged
1. After the terraform apply is successful, you can merge the PR
   1. We enforce squashing commits into `main` to maintain a tidier history
   1. We also adhere to Conventional Commit messages as mentioned below, see the commit history for examples of this
   1. If you do not have permissions to merge into `main` then one of the maintainers will do this for you 

## Conventional Commits

We use the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0) specification for commit messages and branch names. See the link for full details on this standard.
