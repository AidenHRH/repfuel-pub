// eslint-disable-next-line @typescript-eslint/no-require-imports
const { releaseInfo } = require('../../scripts/release-info');

describe('releaseInfo', () => {
  test('a branch push releases v<app version>', () => {
    expect(releaseInfo({ refType: 'branch', refName: 'main', version: '0.2.0' })).toEqual({ tag: 'v0.2.0', prerelease: false });
  });

  test('builds from a working branch are always pre-releases', () => {
    expect(releaseInfo({ refType: 'branch', refName: 'ccr-feature', version: '0.2.0' })).toEqual({
      tag: 'v0.2.0',
      prerelease: true,
    });
  });

  test('versions with a suffix are pre-releases even from main', () => {
    expect(releaseInfo({ refType: 'branch', refName: 'main', version: '0.1.0-stage1' })).toEqual({
      tag: 'v0.1.0-stage1',
      prerelease: true,
    });
  });

  test('a tag push uses the tag when it matches the app version', () => {
    expect(releaseInfo({ refType: 'tag', refName: 'v0.3.0', version: '0.3.0' })).toEqual({ tag: 'v0.3.0', prerelease: false });
  });

  test('a tag that disagrees with app.json is refused, so the APK never reports the wrong version', () => {
    expect(() => releaseInfo({ refType: 'tag', refName: 'v0.2.0-stage2', version: '0.1.0' })).toThrow(/app\.json/);
  });
});
