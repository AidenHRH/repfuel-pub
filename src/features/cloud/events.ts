type Listener = () => void;
const listeners = new Set<Listener>();

/** Tells Settings that a backup ran (or failed) in the background, so it shows the new status. */
export const cloudEvents = {
  emit() {
    listeners.forEach((l) => l());
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
