type Listener = () => void;

const listeners = new Set<Listener>();

/** Tells screens a reminder changed (switched, re-timed, or ticked off), so they refresh. */
export const reminderEvents = {
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
