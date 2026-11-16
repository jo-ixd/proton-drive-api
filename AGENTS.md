# Proton Drive API for the CLI

Interact with the proton drive CLI safely through a guarded API. Gate access for AI agents or other users on your device to safely interact with your Proton Drive account.

## Useful Commands

No commands yet - to be filled in as project builds.

## Code rules

This is a typescript codebase, do the following:

- never use `any` types
- never use return types, rely on inference
- avoid undefined
- never use `as` casting

Follow conventional commits and simple plain English messages describing what you did not how you did it, for example, `docs: changed AGENTS.md`. Make sure to commit often.

Make sure you after writing the code you run the local pipeline. Lint, format, typecheck, test and build - fix anything that falls out.

## Submitting PRs

Never merge a pull request, period. If a user asks you to put up a PR. Follow this order of operations: run verification pipeline, get a code review from a different agent from another model family (e.g. Claude or Grok) in fresh context, fix issues raised and push back where needed.

Never open a PR that has not run through this order of operations. Open PRs as draft only.

When writing a PR follow the `PULL_REQUEST_TEMPLATE.md` and fill in the sections in short, plain English, if the size of change is medium or above ensure the human review checkbox remains unticked, is the size of change is small tick it.