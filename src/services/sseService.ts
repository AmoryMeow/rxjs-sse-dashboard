import { map } from "rxjs/operators";

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
