#!/usr/bin/env tsx
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface PackageJson {
  version: string;
  [key: string]: unknown;
}

type ReleaseType = 'major' | 'minor' | 'patch';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const changelogOnly = args.has('--changelog-only');
const cwd = process.cwd();
const packagePath = resolve(cwd, 'package.json');
const changelogPath = resolve(cwd, 'CHANGELOG.md');
const packageJson = JSON.parse(
  readFileSync(packagePath, 'utf8')
) as PackageJson;
const commits = readConventionalCommits();
const releaseType = determineReleaseType(commits);
const nextVersion = bumpVersion(packageJson.version, releaseType);
const changelogEntry = renderChangelogEntry(nextVersion, commits);

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        currentVersion: packageJson.version,
        nextVersion,
        releaseType,
        commitCount: commits.length,
        changelogEntry
      },
      null,
      2
    )
  );
  process.exit(0);
}

writeFileSync(changelogPath, mergeChangelog(changelogEntry), 'utf8');

if (!changelogOnly) {
  packageJson.version = nextVersion;
  writeFileSync(
    packagePath,
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8'
  );
}

console.log(
  changelogOnly
    ? `Updated CHANGELOG.md for ${nextVersion}.`
    : `Prepared release ${nextVersion}.`
);

function readConventionalCommits(): string[] {
  try {
    const latestTag = execSync('git describe --tags --abbrev=0', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();
    return gitLog(`${latestTag}..HEAD`);
  } catch {
    return gitLog('HEAD');
  }
}

function gitLog(range: string): string[] {
  try {
    return execSync(`git log ${range} --pretty=format:%s`, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && /^[a-z]+(\(.+\))?!?: /.test(line));
  } catch {
    return [];
  }
}

function determineReleaseType(commits: string[]): ReleaseType {
  if (
    commits.some(
      (commit) => commit.includes('!:') || /BREAKING CHANGE/i.test(commit)
    )
  ) {
    return 'major';
  }

  if (commits.some((commit) => commit.startsWith('feat'))) {
    return 'minor';
  }

  return 'patch';
}

function bumpVersion(version: string, type: ReleaseType): string {
  const [major = 0, minor = 0, patch = 0] = version
    .split('.')
    .map((part) => Number(part));

  if (type === 'major') {
    return `${major + 1}.0.0`;
  }

  if (type === 'minor') {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

function renderChangelogEntry(version: string, commits: string[]): string {
  const date = new Date().toISOString().slice(0, 10);
  const sections = [
    ['Features', commits.filter((commit) => commit.startsWith('feat'))],
    ['Fixes', commits.filter((commit) => commit.startsWith('fix'))],
    [
      'Other Changes',
      commits.filter(
        (commit) => !commit.startsWith('feat') && !commit.startsWith('fix')
      )
    ]
  ] as const;
  const body = sections
    .filter(([, entries]) => entries.length > 0)
    .map(
      ([title, entries]) =>
        `### ${title}\n\n${entries.map((entry) => `- ${entry}`).join('\n')}`
    )
    .join('\n\n');

  return `## ${version} - ${date}\n\n${body.length > 0 ? body : '- Maintenance release.'}\n`;
}

function mergeChangelog(entry: string): string {
  const existing = existsSync(changelogPath)
    ? readFileSync(changelogPath, 'utf8').trimEnd()
    : '# Changelog';

  if (existing === '# Changelog') {
    return `${existing}\n\n${entry}\n`;
  }

  return existing.replace(/^# Changelog\n?/, `# Changelog\n\n${entry}\n`);
}
