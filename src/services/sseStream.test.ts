import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  connectionStatus$,
  createSseEventStream,
  reconnectSse,
  type SseConnectionStatus,
} from "./sseStream";

class FakeDocument extends EventTarget {
  hidden = false;
}

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

describe("SSE connection lifecycle", () => {
  let fakeDocument: FakeDocument;

  beforeEach(() => {
    fakeDocument = new FakeDocument();
    FakeEventSource.instances = [];
    vi.stubGlobal("document", fakeDocument);
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reports status, pauses in the background, and reconnects manually", () => {
    const statuses: SseConnectionStatus[] = [];
    const messages: MessageEvent[] = [];
    const statusSubscription = connectionStatus$.subscribe((status) =>
      statuses.push(status)
    );
    const eventSubscription = createSseEventStream().subscribe((event) =>
      messages.push(event)
    );

    const firstSource = FakeEventSource.instances[0];
    expect(firstSource.url).toContain("stream.wikimedia.org");
    expect(statuses.at(-1)).toBe("connecting");

    firstSource.onopen?.({} as Event);
    firstSource.onmessage?.({ data: "event" } as MessageEvent);
    expect(statuses.at(-1)).toBe("connected");
    expect(messages).toHaveLength(1);

    fakeDocument.hidden = true;
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    expect(firstSource.closed).toBe(true);
    expect(statuses.at(-1)).toBe("paused");

    fakeDocument.hidden = false;
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    const secondSource = FakeEventSource.instances[1];
    expect(statuses.at(-1)).toBe("connecting");

    secondSource.onerror?.({} as Event);
    expect(statuses.at(-1)).toBe("reconnecting");

    reconnectSse();
    expect(secondSource.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(3);
    expect(statuses.at(-1)).toBe("connecting");

    const thirdSource = FakeEventSource.instances[2];
    eventSubscription.unsubscribe();
    expect(thirdSource.closed).toBe(true);
    statusSubscription.unsubscribe();
  });
});
