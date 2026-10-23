// expo-camera only offers Google's barcode scanner when it can see the Play Store app installed. Since
// Android 11, apps can't see other apps unless they declare them, so without this the check always fails
// and RepFuel fell back to its own camera. Declaring Google Play is all that's needed.
const { withAndroidManifest } = require('expo/config-plugins');

const PLAY_STORE = 'com.android.vending';

function addPlayStoreQuery(androidManifest) {
  const manifest = androidManifest.manifest;
  manifest.queries = manifest.queries?.length ? manifest.queries : [{}];
  const queries = manifest.queries[0];
  queries.package = queries.package ?? [];
  if (!queries.package.some((p) => p.$?.['android:name'] === PLAY_STORE)) {
    queries.package.push({ $: { 'android:name': PLAY_STORE } });
  }
  return androidManifest;
}

function withPlayStoreQuery(config) {
  return withAndroidManifest(config, (mod) => {
    mod.modResults = addPlayStoreQuery(mod.modResults);
    return mod;
  });
}

module.exports = withPlayStoreQuery;
module.exports.addPlayStoreQuery = addPlayStoreQuery;
