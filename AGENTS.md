# Proton Drive API for the CLI

Interact with the proton drive CLI safely through a guarded API. Gate access for AI agents or other users on your device to safely interact with your Proton Drive account.

## Useful Commands

From the repository root:

- `npm run check` — full local pipeline (format check, lint, typecheck, unit tests, e2e tests, build)
- `npm run lint` — ESLint
- `npm run format` — Prettier write
- `npm run format:check` — Prettier check (CI)
- `npm run typecheck` — TypeScript without emit (src and tests)
- `npm run test` — Vitest unit tests (`tests/unit`)
- `npm run test:e2e` — Vitest e2e tests (`tests/e2e`)
- `npm run build` — compile `src` to `dist`

## Code rules

Implementation will be TypeScript. See `docs/PLAN.md`. Until that code exists, these rules apply to it:

- never use `any` types
- never use return types, rely on inference
- avoid undefined
- never use `as` casting

Follow conventional commits and simple plain English messages describing what you did not how you did it, for example, `docs: changed AGENTS.md`. Make sure to commit often.

After you write code, run the local pipeline. Lint, format, typecheck, test, and build, and fix anything that fails. Docs-only changes skip that pipeline until it exists. When the scripts are in the repo, run the ones that apply.

## Submitting PRs

Never merge a pull request, period. If a user asks you to put up a PR. Follow this order of operations: run verification pipeline, get a code review from a different agent from another model family (e.g. Claude or Grok) in fresh context, fix issues raised and push back where needed.

Never open a PR that has not run through this order of operations. Open PRs as draft only.

When writing a PR follow the `PULL_REQUEST_TEMPLATE.md` and fill in the sections in short, plain English. Leave the human review checkbox unticked for medium or larger changes. Tick it for small changes.
