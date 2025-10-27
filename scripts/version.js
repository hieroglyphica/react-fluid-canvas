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

  if (changelogContent.includes(unreleasedHeader)) {
    // Replace [Unreleased] with the new version and date, and add a new [Unreleased] section at the top.
    changelogContent = changelogContent.replace(
      unreleasedHeader,
      `${unreleasedHeader}\n\n${newVersionHeader}`
    );
    fs.writeFileSync(changelogPath, changelogContent);
    console.log(`✅ Updated CHANGELOG.md to version ${newVersion}`);
  }
} catch (error) {
  console.error('Error updating CHANGELOG.md:', error);
  process.exit(1);
}

// --- Update README.md ---
try {
  const readmePath = path.resolve(__dirname, '../README.md');
  let readmeContent = fs.readFileSync(readmePath, 'utf8');
  // Replace the "Last Stable" version number
  readmeContent = readmeContent.replace(/- \*\*Last Stable\*\*: \d+\.\d+\.\d+/, `- **Last Stable**: ${newVersion}`);
  fs.writeFileSync(readmePath, readmeContent);
  console.log(`✅ Updated README.md to version ${newVersion}`);
} catch (error) {
  console.error('Error updating README.md:', error);
  process.exit(1);
}
