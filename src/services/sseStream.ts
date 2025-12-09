import { Observable } from "rxjs";

const SSE_URL = "https://sse.dev/test";

export function createSseEventStream(): Observable<MessageEvent> {
  return new Observable<MessageEvent>((subscriber) => {
    const source = new EventSource(SSE_URL);

    source.onmessage = (event) => {
      subscriber.next(event);
    };

    source.onerror = (error) => {
      subscriber.error(error);
    };

    return () => {
      source.close();
    };
  });
}
