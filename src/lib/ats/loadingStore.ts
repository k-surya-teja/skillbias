/**
 * Tiny pub/sub for "how many API calls are in flight right now". Used by
 * `atsFetch` to bracket every request and by `ApiLoadingIndicator` to render
 * a global "loading" hint while count > 0.
 *
 * Module-level state is fine here: it's process-scoped (one per browser tab)
 * and we only ever read/write from client code.
 */

type Listener = (count: number) => void;

let count = 0;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    try {
      listener(count);
    } catch {
      // A bad listener shouldn't take down the others.
    }
  }
}

export function startApiCall(): void {
  count += 1;
  notify();
}

export function endApiCall(): void {
  count = Math.max(0, count - 1);
  notify();
}

export function subscribeApiLoading(listener: Listener): () => void {
  listeners.add(listener);
  // Push current value immediately so the subscriber renders the right thing.
  listener(count);
  return () => {
    listeners.delete(listener);
  };
}

/** Read-only snapshot — useful in tests. */
export function getInFlightCount(): number {
  return count;
}
