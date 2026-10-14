import { Observable } from "rxjs";

const DEFAULT_SSE_URL =
  "https://stream.wikimedia.org/v2/stream/recentchange";

export const createSseEventStream = (): Observable<MessageEvent> => {
  return new Observable<MessageEvent>((subscriber) => {
    const url = import.meta.env.VITE_SSE_URL || DEFAULT_SSE_URL;
    let source: EventSource | null = null;

    const closeSource = () => {
      source?.close();
      source = null;
    };

    const openSource = () => {
      if (source || subscriber.closed) return;

      source = new EventSource(url);
      source.onmessage = (event) => subscriber.next(event);
      source.onerror = (error) => {
        console.warn("SSE connection interrupted; reconnecting:", error);
      };
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        closeSource();
      } else {
        openSource();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    handleVisibilityChange();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      closeSource();
    };
  });
};
