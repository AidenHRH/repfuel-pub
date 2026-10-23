// Decides the release tag for a CI run. Used by .github/workflows/release.yml.
//   branch push → v<app.json version>; a pre-release unless it's main and the version has no suffix
//   tag push    → the tag, which must match app.json so the APK reports the same version
const fs = require('fs');
const path = require('path');

function releaseInfo({ refType, refName, version }) {
  const expected = `v${version}`;
  if (refType === 'tag' && refName !== expected) {
    throw new Error(`Tag ${refName} does not match app.json version ${version}; set app.json to ${refName.replace(/^v/, '')} first.`);
  }
  const tag = expected;
  const prerelease = tag.includes('-') || (refType === 'branch' && refName !== 'main');
  return { tag, prerelease };
}

if (require.main === module) {
  const { version } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8')).expo;
  const info = releaseInfo({ refType: process.env.GITHUB_REF_TYPE, refName: process.env.GITHUB_REF_NAME, version });
  process.stdout.write(`tag=${info.tag}\nprerelease=${info.prerelease}\n`);
}

module.exports = { releaseInfo };
