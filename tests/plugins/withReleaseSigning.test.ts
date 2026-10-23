import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyReleaseSigning } = require('../../plugins/withReleaseSigning');

// The android/app/build.gradle that `expo prebuild` generates for SDK 58.
const stock = fs.readFileSync(path.join(__dirname, '../fixtures/sdk58-app-build.gradle'), 'utf8');

function releaseBlock(gradle: string): string {
  const buildTypes = gradle.slice(gradle.indexOf('buildTypes {'));
  return buildTypes.slice(buildTypes.indexOf('release {'), buildTypes.indexOf('packagingOptions'));
}

describe('applyReleaseSigning', () => {
  const out: string = applyReleaseSigning(stock);

  test('release builds are signed with the committed RepFuel key, not the debug key', () => {
    expect(releaseBlock(out)).toContain('signingConfig signingConfigs.release');
    expect(releaseBlock(out)).not.toContain('signingConfig signingConfigs.debug');
  });

  test('defines a release signing config read from android-signing/signing.properties', () => {
    expect(out).toContain("rootProject.file('../android-signing/signing.properties')");
    const signingConfigs = out.slice(out.indexOf('signingConfigs {'), out.indexOf('buildTypes {'));
    expect(signingConfigs).toMatch(/release \{[\s\S]*storeFile[\s\S]*storePassword[\s\S]*keyAlias[\s\S]*keyPassword/);
  });

  test('a missing signing file fails the build instead of silently using the debug key', () => {
    expect(out).toMatch(/throw new GradleException\(/);
  });

  test('versionCode comes from REPFUEL_VERSION_CODE, falling back to app.json', () => {
    expect(out).toContain("versionCode ((System.getenv('REPFUEL_VERSION_CODE') ?: '1') as Integer)");
    expect(out).not.toMatch(/versionCode 1\b/);
  });

  test('debug builds keep the debug key', () => {
    const buildTypes = out.slice(out.indexOf('buildTypes {'));
    const debug = buildTypes.slice(buildTypes.indexOf('debug {'), buildTypes.indexOf('release {'));
    expect(debug).toContain('signingConfig signingConfigs.debug');
  });

  test('applying twice changes nothing', () => {
    expect(applyReleaseSigning(out)).toBe(out);
  });

  test('refuses to guess when the gradle file has an unexpected shape', () => {
    expect(() => applyReleaseSigning('android { }')).toThrow(/signingConfigs/);
  });
});
