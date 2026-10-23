type Listener = (key: string) => void;

const listeners = new Set<Listener>();

/** Tells screens that a setting changed (e.g. Today hiding the daily line). */
export const settingsEvents = {
  emit(key: string) {
    listeners.forEach((l) => l(key));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
