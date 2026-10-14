import {
  bufferTime,
  filter,
  map,
  scan,
  shareReplay,
} from "rxjs/operators";
import { BehaviorSubject, combineLatest, type Observable } from "rxjs";

import { createSseEventStream } from "./sseStream";
import type {
  Actor,
  MetricEvent,
  MetricFilters,
  MetricStatus,
  Project,
} from "../types";

const SAMPLE_WINDOW_MS = 5_000;
const MAX_POINTS_PER_SERIES = 60;
const PROJECTS: Project[] = ["wikipedia", "wikidata", "commons"];
const ACTORS: Actor[] = ["human", "bot"];

interface WikimediaRecentChange {
  bot?: boolean;
  meta?: {
    domain?: string;
  };
}

const raw$ = createSseEventStream();

const parseRecentChange = (data: string): WikimediaRecentChange | null => {
  try {
    const parsed: unknown = JSON.parse(data);

    if (typeof parsed !== "object" || parsed === null) return null;

    return parsed as WikimediaRecentChange;
  } catch {
    return null;
  }
};

const getProject = (domain: string | undefined): Project | null => {
  if (domain === "www.wikidata.org") return "wikidata";
  if (domain === "commons.wikimedia.org") return "commons";
  if (domain?.endsWith(".wikipedia.org")) return "wikipedia";

  return null;
};

const getStatus = (value: number): MetricStatus => {
  if (value >= 20) return "critical";
  if (value >= 10) return "warning";
  return "ok";
};

const getMetricKey = (metric: MetricEvent): string => {
  return `${metric.project}:${metric.actor}:${metric.metric}`;
};

const metricBatches$: Observable<MetricEvent[]> = raw$.pipe(
  map((event) => parseRecentChange(event.data)),
  filter((event): event is WikimediaRecentChange => event !== null),
  map((event) => ({
    project: getProject(event.meta?.domain),
    actor: event.bot ? ("bot" as const) : ("human" as const),
  })),
  filter(
    (event): event is { project: Project; actor: Actor } =>
      event.project !== null
  ),
  bufferTime(SAMPLE_WINDOW_MS),
  filter((events) => events.length > 0),
  map((events) => {
    const receivedAt = Date.now();
    const counts = new Map<string, number>();

    events.forEach(({ project, actor }) => {
      const key = `${project}:${actor}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return PROJECTS.flatMap((project) =>
      ACTORS.map((actor): MetricEvent => {
        const eventCount = counts.get(`${project}:${actor}`) ?? 0;
        const value = eventCount / (SAMPLE_WINDOW_MS / 1_000);

        return {
          id: crypto.randomUUID(),
          project,
          actor,
          metric: "changes_per_second",
          unit: "changes/s",
          value,
          status: getStatus(value),
          receivedAt,
        };
      })
    );
  }),
  shareReplay({ bufferSize: 1, refCount: true })
);

const filters$ = new BehaviorSubject<MetricFilters>({
  project: "all",
  actor: "all",
});

const matchesFilters = (metric: MetricEvent, filters: MetricFilters) => {
  const projectMatch =
    filters.project === "all" || filters.project === metric.project;
  const actorMatch =
    filters.actor === "all" || filters.actor === metric.actor;

  return projectMatch && actorMatch;
};

export const setFilters = (next: MetricFilters) => {
  filters$.next(next);
};

export const createLastMetrics$ = (
  timeWindowMs = 5 * 60 * 1000
): Observable<Map<string, MetricEvent[]>> => {
  const lastMetricsByKey$ = metricBatches$.pipe(
    scan<MetricEvent[], Map<string, MetricEvent[]>>((acc, batch) => {
      const timeThreshold = Date.now() - timeWindowMs;
      const newMap = new Map<string, MetricEvent[]>();

      acc.forEach((history, key) => {
        const recentHistory = history
          .filter((event) => event.receivedAt >= timeThreshold)
          .slice(0, MAX_POINTS_PER_SERIES - 1);

        if (recentHistory.length > 0) {
          newMap.set(key, recentHistory);
        }
      });

      batch.forEach((value) => {
        const key = getMetricKey(value);
        const history = newMap.get(key) ?? [];
        newMap.set(key, [value, ...history].slice(0, MAX_POINTS_PER_SERIES));
      });

      return newMap;
    }, new Map())
  );

  return combineLatest([lastMetricsByKey$, filters$]).pipe(
    map(([lastMetricsByKey, filters]) => {
      const visibleMetrics = new Map<string, MetricEvent[]>();

      lastMetricsByKey.forEach((history, key) => {
        const latestMetric = history[0];

        if (latestMetric && matchesFilters(latestMetric, filters)) {
          visibleMetrics.set(key, history);
        }
      });

      return visibleMetrics;
    })
  );
};
