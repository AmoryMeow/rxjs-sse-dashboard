import { BehaviorSubject, Observable, Subject } from "rxjs";

const DEFAULT_SSE_URL =
  "https://stream.wikimedia.org/v2/stream/recentchange";

export type SseConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "paused";

const connectionStatusSubject =
  new BehaviorSubject<SseConnectionStatus>("connecting");
const reconnectSubject = new Subject<void>();

export const connectionStatus$ = connectionStatusSubject.asObservable();

export const reconnectSse = () => reconnectSubject.next();

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

      connectionStatusSubject.next("connecting");
      source = new EventSource(url);
      source.onopen = () => connectionStatusSubject.next("connected");
      source.onmessage = (event) => subscriber.next(event);
      source.onerror = (error) => {
        connectionStatusSubject.next("reconnecting");
        console.warn("SSE connection interrupted; reconnecting:", error);
      };
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        closeSource();
        connectionStatusSubject.next("paused");
      } else {
        openSource();
      }
    };

    const reconnectSubscription = reconnectSubject.subscribe(() => {
      closeSource();
      handleVisibilityChange();
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    handleVisibilityChange();

    return () => {
      reconnectSubscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      closeSource();
    };
  });
};
