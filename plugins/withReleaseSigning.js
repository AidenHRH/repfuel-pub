// Signs release APKs with RepFuel's own key so each new version installs over the
// last one and keeps your data. The release workflow writes the key to android-signing/
// from GitHub Actions secrets (see README); it is never committed.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// @repfuel-release-signing';

const PROPERTIES_LOADER = `${MARKER}
def repfuelSigningFile = rootProject.file('../android-signing/signing.properties')
def repfuelSigning = new Properties()
if (repfuelSigningFile.exists()) {
    repfuelSigningFile.withInputStream { repfuelSigning.load(it) }
}
`;

const RELEASE_SIGNING_CONFIG = `
        release {
            if (!repfuelSigningFile.exists()) {
                throw new GradleException("Missing android-signing/signing.properties: release builds must use RepFuel's own key.")
            }
            storeFile rootProject.file('../android-signing/' + repfuelSigning.getProperty('storeFile'))
            storePassword repfuelSigning.getProperty('storePassword')
            keyAlias repfuelSigning.getProperty('keyAlias')
            keyPassword repfuelSigning.getProperty('keyPassword')
        }`;

function applyReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;

  if (!/signingConfigs \{/.test(gradle) || !/buildTypes \{/.test(gradle) || !/^android \{/m.test(gradle)) {
    throw new Error('withReleaseSigning: build.gradle has no android/signingConfigs/buildTypes blocks; update the plugin.');
  }

  let out = gradle.replace(/^android \{/m, `${PROPERTIES_LOADER}\nandroid {`);
  out = out.replace(/signingConfigs \{/, `signingConfigs {${RELEASE_SIGNING_CONFIG}`);

  const buildTypesAt = out.indexOf('buildTypes {');
  const releaseAt = out.indexOf('release {', buildTypesAt);
  const releaseSigningAt = out.indexOf('signingConfig signingConfigs.debug', releaseAt);
  if (releaseAt === -1 || releaseSigningAt === -1) {
    throw new Error('withReleaseSigning: could not find the release build type signing line; update the plugin.');
  }
  out =
    out.slice(0, releaseSigningAt) +
    'signingConfig signingConfigs.release' +
    out.slice(releaseSigningAt + 'signingConfig signingConfigs.debug'.length);

  // CI passes a value that grows with every build, so Android accepts each APK as an update.
  out = out.replace(/versionCode (\d+)/, "versionCode ((System.getenv('REPFUEL_VERSION_CODE') ?: '$1') as Integer)");

  return out;
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning only supports a Groovy build.gradle');
    }
    mod.modResults.contents = applyReleaseSigning(mod.modResults.contents);
    return mod;
  });
}

module.exports = withReleaseSigning;
module.exports.applyReleaseSigning = applyReleaseSigning;
