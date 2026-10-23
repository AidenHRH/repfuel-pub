// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addPlayStoreQuery } = require('../../plugins/withPlayStoreQuery');

type Manifest = { manifest: { queries?: { package?: { $: Record<string, string> }[]; intent?: unknown[] }[] } };

const packages = (m: Manifest) => (m.manifest.queries ?? []).flatMap((q) => q.package ?? []).map((p) => p.$['android:name']);

test('lets the app see Google Play, so Google’s barcode scanner is used on Android 11+', () => {
  const manifest: Manifest = { manifest: {} };
  expect(packages(addPlayStoreQuery(manifest))).toEqual(['com.android.vending']);
});

test('keeps the queries Expo already declares, and adds Google Play only once', () => {
  const intent = { action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }] };
  const manifest: Manifest = { manifest: { queries: [{ intent: [intent] }] } };
  const once = addPlayStoreQuery(manifest);
  const twice = addPlayStoreQuery(once);
  expect(twice.manifest.queries![0].intent).toEqual([intent]);
  expect(packages(twice)).toEqual(['com.android.vending']);
});
