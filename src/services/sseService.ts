import {
  bufferTime,
  filter,
  map,
  scan,
  shareReplay,
} from "rxjs/operators";
import { BehaviorSubject, combineLatest, type Observable } from "rxjs";

import { createSseEventStream } from "./sseStream";
import {
  classifyRecentChange,
  createMetricBatch,
  filterMetricHistory,
  MAX_POINTS_PER_SERIES,
  parseRecentChange,
  SAMPLE_WINDOW_MS,
  updateMetricHistory,
  type ClassifiedChange,
  type WikimediaRecentChange,
} from "./metricDomain";
import type { MetricEvent, MetricFilters } from "../types";

const raw$ = createSseEventStream();

const metricBatches$: Observable<MetricEvent[]> = raw$.pipe(
  map((event) => parseRecentChange(event.data)),
  filter((event): event is WikimediaRecentChange => event !== null),
  map(classifyRecentChange),
  filter((event): event is ClassifiedChange => event !== null),
  bufferTime(SAMPLE_WINDOW_MS),
  filter((events) => events.length > 0),
  map((events) => createMetricBatch(events, Date.now())),
  shareReplay({ bufferSize: 1, refCount: true })
);

const filters$ = new BehaviorSubject<MetricFilters>({
  project: "all",
  actor: "all",
});

export const setFilters = (next: MetricFilters) => {
  filters$.next(next);
};

interface VisibleMetricsOptions {
  timeWindowMs?: number;
  maxPoints?: number;
  now?: () => number;
}

export const createVisibleMetrics$ = (
  batches$: Observable<MetricEvent[]>,
  filterChanges$: Observable<MetricFilters>,
  {
    timeWindowMs = 5 * 60 * 1000,
    maxPoints = MAX_POINTS_PER_SERIES,
    now = Date.now,
  }: VisibleMetricsOptions = {}
): Observable<Map<string, MetricEvent[]>> => {
  const historyByKey$ = batches$.pipe(
    scan<MetricEvent[], Map<string, MetricEvent[]>>((acc, batch) => {
      return updateMetricHistory(
        acc,
        batch,
        now(),
        timeWindowMs,
        maxPoints
      );
    }, new Map())
  );

  return combineLatest([historyByKey$, filterChanges$]).pipe(
    map(([historyByKey, activeFilters]) =>
      filterMetricHistory(historyByKey, activeFilters)
    )
  );
};

export const createLastMetrics$ = (
  timeWindowMs = 5 * 60 * 1000
): Observable<Map<string, MetricEvent[]>> => {
  return createVisibleMetrics$(metricBatches$, filters$, { timeWindowMs });
};
