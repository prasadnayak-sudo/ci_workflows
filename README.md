# ci-workflows

Reusable GitHub Actions workflows shared across repos, plus the scripts they run.

Every consuming repo carries only a thin caller file, so a fix here reaches all
of them without editing each repo.

## Usage

```yaml
# .github/workflows/checks.yml
name: Checks
on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [main, dev]
jobs:
  checks:
    uses: prasadnayak-sudo/ci_workflows/.github/workflows/checks.yml@v1
```

```yaml
# .github/workflows/pr-impact.yml
name: PR Impact
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main, dev]
jobs:
  impact:
    uses: prasadnayak-sudo/ci_workflows/.github/workflows/pr-impact.yml@v1
    secrets: inherit
```

```yaml
# .github/workflows/post-merge-summary.yml
name: Post-merge Summary
on:
  pull_request:
    types: [closed]
    branches: [main, dev]
jobs:
  summary:
    uses: prasadnayak-sudo/ci_workflows/.github/workflows/post-merge-summary.yml@v1
    secrets: inherit
```

## Workflows

| Workflow | What it does | Gate? |
| --- | --- | --- |
| `checks.yml` | `tsc -b`, lint, tests | Yes — make the `tests` job the required check |
| `pr-impact.yml` | Impact report as a PR comment, compact summary in the PR description | No, report only |
| `post-merge-summary.yml` | Summary on the merged PR and on the merge commit | No, report only |

## Inputs

All three take an optional `node-version` (default `24`).
`pr-impact` and `post-merge-summary` also take `tools-path` (default `.ci-tools`),
the directory this repo is checked out into inside the caller's workspace.

## Secrets

`COPILOT_PAT` is optional. Without it the AI-written prose is skipped and the
deterministic, fact-based summary is still produced. Pass it with
`secrets: inherit`.

## What the consuming repo needs

- `npm ci` must work (a lockfile)
- `npm run lint` and `npm test` scripts, and a solution-style `tsconfig.json` for `tsc -b`
- a `src/` directory — the impact analysis cruises it

The consuming repo does **not** need `dependency-cruiser` or a
`.dependency-cruiser.cjs`; both live here and are supplied at runtime.
