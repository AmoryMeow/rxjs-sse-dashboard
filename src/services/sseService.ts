import { map, scan } from "rxjs/operators";
import type { Observable } from "rxjs";

import { createSseEventStream } from "./sseStream";
import type { EventItem } from "../types";

const raw$ = createSseEventStream();

export const events$ = raw$.pipe(
  map(
    (event): EventItem => ({
      id: crypto.randomUUID(),
      raw: event.data,
      receivedAt: Date.now(),
    })
  )
);

export const createLastEvents$ = (limit = 30): Observable<EventItem[]> => {
  return events$.pipe(
    scan<EventItem, EventItem[]>((acc, value) => {
      return [value, ...acc].slice(0, limit);
    }, [])
  );
};
