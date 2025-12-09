import { map } from "rxjs/operators";

import { createSseEventStream } from "./sseStream";
import type { EventItem } from "../types";

export const events$ = createSseEventStream().pipe(
  map(
    (event): EventItem => ({
      raw: event.data,
      receivedAt: Date.now(),
    })
  )
);
