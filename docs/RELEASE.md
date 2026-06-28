# Release process

See [Trunk-based development and releases](./TRUNK_BASED.md) for the full guide.

## Shape of the flow

```text
push to main
  -> CI verifies local-quality gates again
  -> semantic-release derives the next version
  -> semantic-release commits package.json + CHANGELOG.md as chore(release): vX.Y.Z
  -> semantic-release creates vX.Y.Z tag and GitHub Release
  -> CI skips the release commit
  -> tag push triggers npm publish with provenance
```

The release commit is part of trunk history, so `package.json` and `CHANGELOG.md` match the latest published package. npm publishing only happens from the tag.

## Releasable commits

- `feat: ...` -> minor
- `fix: ...` -> patch
- `perf: ...` -> patch
- `type!: ...` or `BREAKING CHANGE:` -> major

Other Conventional Commit types do not create npm releases by themselves.

## Local checks

Before pushing to `main`, run the local gate:

```bash
pnpm quality
```

For release-sensitive changes, also run:

```bash
pnpm consumer:check
pnpm pack:check
```

## Required setup

- Add `RELEASE_TOKEN` with Contents read/write so `.github/workflows/release.yml` can push release commits and tags that trigger `.github/workflows/publish.yml`.
- Configure npm Trusted Publishing for `.github/workflows/publish.yml`.
- Keep GitHub history linear: no merge commits. If PRs are used, use rebase merge only.
