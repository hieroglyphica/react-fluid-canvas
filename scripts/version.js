import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getNewVersion() {
  // Try to get the new version from environment first (npm sets this when running npm scripts).
  let newVersion = process.env.npm_package_version;
  if (newVersion) {
    return newVersion;
  }
  // Fallback: read package.json version when env var is not provided
  try {
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkgData = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgData);
    return pkg?.version;
  } catch (err) {
    console.error('Could not read version from package.json', err);
    return null;
  }
}

async function updateChangelog(newVersion, today) {
  const changelogPath = path.resolve(__dirname, '../CHANGELOG.md');
  let changelogContent = await fs.readFile(changelogPath, 'utf8');

  const unreleasedHeader = '## [Unreleased]';
  const newVersionHeader = `## [${newVersion}] - ${today}`;

  if (changelogContent.includes(`## [${newVersion}]`)) {
    console.log(`CHANGELOG.md already contains version ${newVersion}; skipping insertion.`);
    return;
  }

  if (changelogContent.includes(unreleasedHeader)) {
    changelogContent = changelogContent.replace(
      unreleasedHeader,
      `${unreleasedHeader}\n\n${newVersionHeader}`
    );
    console.log(`✅ Updated CHANGELOG.md with version ${newVersion}`);
  } else {
    changelogContent = `${unreleasedHeader}\n\n${newVersionHeader}\n\n` + changelogContent;
    console.log(`✅ Prepended CHANGELOG.md with Unreleased + version ${newVersion}`);
  }
  await fs.writeFile(changelogPath, changelogContent);
}

async function updateReadme(newVersion) {
  const readmePath = path.resolve(__dirname, '../README.md');
  let readmeContent = await fs.readFile(readmePath, 'utf8');

  const lastStableRegex = /- \*\*Last Stable\*\*: .*/;
  const replacementLine = `- **Last Stable**: ${newVersion}`;

  if (lastStableRegex.test(readmeContent)) {
    readmeContent = readmeContent.replace(lastStableRegex, replacementLine);
    await fs.writeFile(readmePath, readmeContent);
    console.log(`✅ Updated README.md Last Stable to ${newVersion}`);
    return;
  }

  // Fallback if regex doesn't match
  const statusHeader = '## Status';
  const statusIdx = readmeContent.indexOf(statusHeader);
  if (statusIdx !== -1) {
    const insertPos = readmeContent.indexOf('\n', statusIdx);
    const before = readmeContent.slice(0, insertPos + 1);
    const after = readmeContent.slice(insertPos + 1);
    readmeContent = `${before}${replacementLine}\n${after}`;
    console.log(`✅ Inserted Last Stable into README.md under Status`);
  } else {
    readmeContent = `${replacementLine}\n\n` + readmeContent;
    console.log(`✅ Prepended Last Stable to README.md`);
  }
  await fs.writeFile(readmePath, readmeContent);
}

async function main() {
  const newVersion = await getNewVersion();
  if (!newVersion) {
    console.error('Error: New version not found in environment variables or package.json.');
    process.exit(1);
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  await updateChangelog(newVersion, today);
  await updateReadme(newVersion);
}

main().catch(error => {
  console.error('An error occurred during the versioning script:', error);
  process.exit(1);
});
