# ci-workflows

Reusable GitHub Actions workflows shared by all my repos. The logic lives here
once; each repo carries only a small caller file that points at it.

## What a repo gets

| Workflow | Runs | Does |
|---|---|---|
| `checks` | PR + push to base branches | `tsc -b`, lint, tests. **This is the gate** — make it a required check. |
| `pr-impact` | PR opened / updated | Blast-radius report + dependency graph as a PR comment, and a compact summary written into the PR description. |
| `post-merge-summary` | PR merged | Re-runs the checks on the merged code, reports import health, and posts the summary on the PR, the merge commit, and the run page. |

## Adding it to a repo

From the repo's root:

```bash
npx github:prasadnayak-sudo/ci-workflows init
```

That writes three caller files into `.github/workflows/`. Commit and push them.

Then, once per repo:

1. **Settings → Rules** — make `tests` a required status check on `main` and `dev`.
   Without this, a red PR can still be merged.
2. **Settings → Secrets → Actions** — add `COPILOT_PAT` if you want the
   AI-written prose in summaries. Everything works without it; you just get the
   factual half.
3. **Settings → General → Pull Requests** — set the merge and squash *default
   commit message* to **"Pull request title and description"**, so the summary
   reaches the commit message.

## A caller file

```yaml
name: Checks

on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [main, dev]

jobs:
  checks:
    uses: prasadnayak-sudo/ci-workflows/.github/workflows/checks.yml@v1
```

Keep callers this thin. They exist only to point here — if they carry settings,
changing those settings means visiting every repo again.

`secrets: inherit` is required on `pr-impact` and `post-merge-summary`, or
`COPILOT_PAT` never reaches them and the AI half silently skips.

## Repos that differ

Every command is an input with a default:

```yaml
jobs:
  checks:
    uses: prasadnayak-sudo/ci-workflows/.github/workflows/checks.yml@v1
    with:
      node-version: '20'
      test-command: 'npm run test:ci'
      typecheck-command: ''     # empty string skips the step
      source-dir: 'app'
```

## Releasing a change

Callers pin `@v1`, so nothing moves until the tag moves:

```bash
git commit -am "..."
git push
git tag -f v1 && git push -f origin v1
```

Pin to `@main` instead only if you want every repo to pick changes up
immediately — including the broken ones.

## How the scripts reach a repo

`uses:` fetches the workflow only, not the scripts. The workflows check this
repo out into `.ci-tools` and run the scripts from there, so consumer repos
install nothing:

```yaml
- uses: actions/checkout@v4              # the caller's code
- uses: actions/checkout@v4              # the tools
  with:
    repository: ${{ github.repository_owner }}/ci-workflows
    path: .ci-tools
- run: node .ci-tools/scripts/impact-report.mjs
```

`dependency-cruiser` and `typescript` are dependencies **here**, not in the
consumer repos.

## Pinned TypeScript

`typescript` is pinned to `~6.0.2` on purpose. dependency-cruiser 18.x parses
nothing under TypeScript 7 — it returns an empty graph with **no error**, and
every file then looks like it has no dependents. `buildGraph` throws on an empty
graph so that failure can never be mistaken for "nothing imports this".

## Local development

```bash
npm ci
npm test                                  # the lib's own tests

# run a script against another repo
cd ../some-repo
CHANGED_FILES="src/a.ts" node ../ci-workflows/scripts/impact-report.mjs
```
