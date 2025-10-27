import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get the new version from the environment variable set by npm/yarn
const newVersion = process.env.npm_package_version;

if (!newVersion) {
  console.error('Error: New version not found in environment variables.');
  process.exit(1);
}

const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// --- Update CHANGELOG.md ---
try {
  const changelogPath = path.resolve(__dirname, '../CHANGELOG.md');
  let changelogContent = fs.readFileSync(changelogPath, 'utf8');

  const unreleasedHeader = '## [Unreleased]';
  const newVersionHeader = `## [${newVersion}] - ${today}`;

  // If the changelog already contains the new version header, skip inserting
  if (changelogContent.includes(`## [${newVersion}]`)) {
    console.log(`CHANGELOG.md already contains version ${newVersion}; skipping insertion.`);
  } else if (changelogContent.includes(unreleasedHeader)) {
    // Insert the new version header directly after the Unreleased header (only once)
    changelogContent = changelogContent.replace(
      unreleasedHeader,
      `${unreleasedHeader}\n\n${newVersionHeader}`
    );
    fs.writeFileSync(changelogPath, changelogContent);
    console.log(`✅ Updated CHANGELOG.md with version ${newVersion}`);
  } else {
    // Fallback: append new header at the top if Unreleased header missing
    changelogContent = `${unreleasedHeader}\n\n${newVersionHeader}\n\n` + changelogContent;
    fs.writeFileSync(changelogPath, changelogContent);
    console.log(`✅ Prepend CHANGELOG.md with Unreleased + version ${newVersion}`);
  }
} catch (error) {
  console.error('Error updating CHANGELOG.md:', error);
  process.exit(1);
}

// --- Update README.md ---
try {
  const readmePath = path.resolve(__dirname, '../README.md');
  let readmeContent = fs.readFileSync(readmePath, 'utf8');

  // Replace an existing "Last Stable" line that contains either a semantic version or the word "Unreleased".
  // Matches: - **Last Stable**: 0.1.15  OR  - **Last Stable**: Unreleased
  const lastStableRegex = /- \*\*Last Stable\*\*: .*/;

  const replacementLine = `- **Last Stable**: ${newVersion}`;

  if (lastStableRegex.test(readmeContent)) {
    readmeContent = readmeContent.replace(lastStableRegex, replacementLine);
    fs.writeFileSync(readmePath, readmeContent);
    console.log(`✅ Updated README.md Last Stable to ${newVersion}`);
  } else {
    // If we couldn't find the line, attempt to insert it under the "Status" section, or at top as fallback.
    const statusHeader = 'Status';
    const statusIdx = readmeContent.indexOf(statusHeader);
    if (statusIdx !== -1) {
      // Find end of the Status header line and insert after the header block start
      const insertPos = readmeContent.indexOf('\n', statusIdx);
      const before = readmeContent.slice(0, insertPos + 1);
      const after = readmeContent.slice(insertPos + 1);
      readmeContent = `${before}${replacementLine}\n${after}`;
      fs.writeFileSync(readmePath, readmeContent);
      console.log(`✅ Inserted Last Stable into README.md under Status`);
    } else {
      // Fallback: prepend the replacement line
      readmeContent = `${replacementLine}\n\n` + readmeContent;
      fs.writeFileSync(readmePath, readmeContent);
      console.log(`✅ Prepended Last Stable to README.md`);
    }
  }
} catch (error) {
  console.error('Error updating README.md:', error);
  process.exit(1);
}
