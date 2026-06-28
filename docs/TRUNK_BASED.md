# Trunk-based development and releases

This project optimizes for a single maintainer working directly on `main`, while still leaving room for short-lived PRs later.

## Principles

- `main` is the trunk and should always be releasable.
- Work lands in small, complete increments.
- Direct pushes to `main` are normal for the maintainer.
- PRs are optional and should be short-lived when used.
- History stays linear: no merge commits, no release branches, no long-running integration branches.
- Local checks are run before pushing; CI verifies the same thing again.
- Releases are automated from green `main` with semantic-release.
- Release commits are allowed, but CI intentionally skips them.

## Daily maintainer flow

Start from current trunk:

```bash
git checkout main
git pull --rebase
```

Make a small change, then run the local gate:

```bash
pnpm quality
```

That expands to lint, type/Svelte checks, unit tests, and build.

Commit with Conventional Commits:

```bash
git commit -m "feat: add responsive image presets"
```

Push straight to trunk:

```bash
git push origin main
```

CI runs on the `main` push. If CI passes and the commits since the latest release tag contain releasable work, semantic-release creates a release commit, tag, and GitHub Release. The tag then triggers npm publishing.

## Optional PR flow

Use a PR when a change benefits from review or isolation:

```bash
git checkout -b feat/small-change
# work, check locally, commit
git fetch origin
git rebase origin/main
git push --force-with-lease
```

Merge with **Rebase and merge** only. Delete the branch afterwards.

## Commit types and version bumps

semantic-release inspects Conventional Commits since the latest `vX.Y.Z` tag.

Releasing commits:

| Commit kind                               | Version bump |
| ----------------------------------------- | ------------ |
| `feat: ...`                               | minor        |
| `fix: ...`                                | patch        |
| `perf: ...`                               | patch        |
| `type!: ...` or `BREAKING CHANGE:` footer | major        |

Non-releasing commits:

- `docs: ...`
- `test: ...`
- `chore: ...`
- `ci: ...`
- `refactor: ...`
- any other valid Conventional Commit type that is not breaking

Non-releasing commits do not create npm releases by themselves. If they are present alongside a later releasable commit, they can still appear in that release's notes.

## Automated release flow

```text
push to main
  -> CI verifies lint/check/test/build/e2e
  -> Release workflow runs after green CI
  -> semantic-release computes next version from commits since latest vX.Y.Z tag
  -> semantic-release updates package.json and CHANGELOG.md
  -> semantic-release commits chore(release): vX.Y.Z
  -> semantic-release creates vX.Y.Z tag and GitHub Release
  -> CI skips the chore(release) commit
  -> tag push triggers Publish to npm workflow
  -> package is validated and published with provenance
```

The release commit is intentionally part of trunk history so `package.json` and `CHANGELOG.md` reflect the latest published version. The tag points at that release commit.

## GitHub repository settings

Recommended for the single-maintainer phase:

- Allow direct pushes to `main` by the maintainer.
- Require linear history.
- Disable merge commits.
- Disable squash merges if PRs are enabled.
- Enable **Rebase and merge** for PRs.
- Disallow force pushes to `main`.
- Disallow branch deletion for `main`.

When outside contributors arrive, add branch protection requiring PRs for non-maintainers and require `CI` before merge.

Use repository rulesets/branch protection, not CI, to enforce linear history and block merge commits.

## Required automation setup

### `RELEASE_TOKEN`

Create a repository secret named `RELEASE_TOKEN` for `.github/workflows/release.yml`.

Use a fine-grained PAT or GitHub App token with Contents read/write access to this repository. This is needed because release commits and tag pushes made with the default `GITHUB_TOKEN` do not trigger downstream workflows reliably.

### npm Trusted Publishing

Configure npm Trusted Publishing for:

- repository: `cwygoda/f8`
- workflow: `.github/workflows/publish.yml`

No `NPM_TOKEN` is required.
