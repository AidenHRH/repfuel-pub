import { File } from 'expo-file-system';

import type { Cloud, CloudUser } from '@/services/cloud/types';
import { CloudError, type CloudFailure } from '@/services/cloud/types';

/** An in-memory stand-in for the backup server: files by path, one account, and a switch to make it fail. */
export function fakeCloud(user: CloudUser | null = { id: 'user-1', email: 'me@example.com' }) {
  const files = new Map<string, string>();
  const state = { user, failWith: null as CloudFailure | null, codeSentTo: null as string | null };
  const check = () => {
    if (state.failWith) throw new CloudError(state.failWith);
  };
  const store = File as unknown as { store: Map<string, string> };
  const cloud: Cloud = {
    auth: {
      currentUser: async () => state.user,
      sendCode: async (email) => {
        check();
        state.codeSentTo = email;
      },
      verifyCode: async (email, code) => {
        check();
        if (code !== '123456') throw new CloudError('other', 'That code isn’t right');
        state.user = { id: 'user-1', email };
        return state.user;
      },
      signOut: async () => {
        state.user = null;
      },
    },
    store: {
      list: async (folder) => {
        check();
        const prefix = `${folder}/`;
        return [...files.keys()]
          .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
          .map((p) => p.slice(prefix.length));
      },
      uploadText: async (path, text) => {
        check();
        files.set(path, text);
      },
      uploadBytes: async (path, bytes) => {
        check();
        files.set(path, new TextDecoder().decode(bytes));
      },
      downloadText: async (path) => {
        check();
        const text = files.get(path);
        if (text === undefined) throw new CloudError('other', 'not found');
        return text;
      },
      downloadToFile: async (path, file) => {
        check();
        const text = files.get(path);
        if (text === undefined) throw new CloudError('other', 'not found');
        store.store.set(file.uri, text);
      },
      remove: async (paths) => {
        check();
        for (const p of paths) files.delete(p);
      },
    },
  };
  return { cloud, files, state };
}
