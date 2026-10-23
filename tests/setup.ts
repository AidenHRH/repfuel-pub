// expo-crypto is a native module; under Jest give it Node's implementation.
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('crypto')>('crypto').randomUUID(),
}));

// Swipe gestures can't run in Jest (Reanimated's JS shared values lack listeners). Render the row with its
// swipe actions alongside, so tests can press them; the gesture itself is checked on the device.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Swipeable = React.forwardRef(
    (props: { children?: React.ReactNode; renderRightActions?: () => React.ReactNode }, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        close: () => undefined,
        openLeft: () => undefined,
        openRight: () => undefined,
        reset: () => undefined,
      }));
      return React.createElement(View, null, props.children, props.renderRightActions?.());
    },
  );
  return { __esModule: true, default: Swipeable };
});

// Notifications are native; tests see a quiet stand-in with the real constants.
jest.mock('expo-notifications', () => ({
  ...jest.requireActual('expo-notifications'),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationCategoryAsync: jest.fn(async () => null),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: 'granted' })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: () => undefined })),
}));

// Files and sharing are native; tests get an in-memory file system and a share sheet that records what it shared.
jest.mock('expo-file-system', () => {
  const store = new Map<string, string>();
  class Directory {
    uri: string;
    constructor(...parts: (string | Directory)[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    get exists() {
      return true;
    }
    create() {}
  }
  class File {
    static store = store;
    static pickFileAsync = jest.fn(
      async (): Promise<{ canceled: boolean; result: File | null }> => ({ canceled: true, result: null }),
    );
    readonly uri: string;
    constructor(...parts: (string | Directory | File)[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    create() {
      store.set(this.uri, '');
    }
    async write(content: string) {
      store.set(this.uri, content);
    }
    async text() {
      return store.get(this.uri) ?? '';
    }
    async bytes() {
      return new TextEncoder().encode(store.get(this.uri) ?? '');
    }
    get exists() {
      return store.has(this.uri);
    }
    copy(to: File) {
      store.set(to.uri, store.get(this.uri) ?? 'photo');
    }
    delete() {
      store.delete(this.uri);
    }
  }
  return { File, Directory, Paths: { cache: new Directory('file:///cache'), document: new Directory('file:///docs') } };
});
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

// Views have no real layout in tests: every tour target is on screen at the same place.
jest.mock('@/features/tour/measure', () => ({
  measureTarget: jest.fn(async () => ({ x: 16, y: 120, width: 200, height: 48 })),
}));

// The embedded video player is native; tests see a plain view carrying what it would load.
jest.mock('react-native-webview', () => {
  const { View } = jest.requireActual('react-native');
  return { WebView: (props: object) => jest.requireActual('react').createElement(View, props) };
});

// The photo picker is native; tests choose what it returns.
jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

// The backup server: a signed-out in-memory stand-in. Tests that sign in swap it with __setFake(fakeCloud(...)).
jest.mock('@/services/cloud', () => {
  const types = jest.requireActual('@/services/cloud/types');
  const { fakeCloud } = jest.requireActual('./helpers/fakeCloud');
  let current = fakeCloud(null);
  return {
    ...types,
    getCloud: () => current.cloud,
    __setFake: (next: ReturnType<typeof fakeCloud>) => {
      current = next;
    },
  };
});
