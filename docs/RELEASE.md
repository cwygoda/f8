# Release readiness

## Quality gates

Run the local release-readiness gate before publishing:

```bash
pnpm install
pnpm lint
pnpm check
pnpm test
pnpm build
pnpm release:dry-run
```

Optional browser coverage requires Playwright browsers:

```bash
pnpm test:e2e:install
pnpm test:e2e
```

## Conventional Commit release flow

`pnpm release:dry-run` reads Conventional Commit subjects since the latest Git tag, determines the next semantic version (`feat` = minor, `fix`/other = patch, `!` = major), and prints the changelog entry without writing files.

`pnpm changelog` updates `CHANGELOG.md` only. `pnpm release` updates both `CHANGELOG.md` and `package.json`.

## Package checks

`pnpm pack:check` builds the library and runs `pnpm pack --dry-run` so the published files and package exports can be reviewed before publishing.
