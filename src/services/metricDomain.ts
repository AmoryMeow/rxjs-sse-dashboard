import type {
  Actor,
  MetricEvent,
  MetricFilters,
  MetricStatus,
  Project,
} from "../types";

export const SAMPLE_WINDOW_MS = 5_000;
export const MAX_POINTS_PER_SERIES = 60;

const PROJECTS: Project[] = ["wikipedia", "wikidata", "commons"];
const ACTORS: Actor[] = ["human", "bot"];

export interface WikimediaRecentChange {
  bot: boolean;
  meta: {
    domain: string;
  };
}

export interface ClassifiedChange {
  project: Project;
  actor: Actor;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

export const parseRecentChange = (
  data: string
): WikimediaRecentChange | null => {
  try {
    const parsed: unknown = JSON.parse(data);

    if (!isRecord(parsed) || !isRecord(parsed.meta)) return null;
    if (typeof parsed.meta.domain !== "string") return null;
    if (parsed.bot !== undefined && typeof parsed.bot !== "boolean") return null;

    return {
      bot: parsed.bot === true,
      meta: { domain: parsed.meta.domain },
    };
  } catch {
    return null;
  }
};

export const getProject = (domain: string): Project | null => {
  if (domain === "www.wikidata.org") return "wikidata";
  if (domain === "commons.wikimedia.org") return "commons";
  if (domain.endsWith(".wikipedia.org")) return "wikipedia";

  return null;
};

export const classifyRecentChange = (
  change: WikimediaRecentChange
): ClassifiedChange | null => {
  const project = getProject(change.meta.domain);

  if (!project) return null;

  return {
    project,
    actor: change.bot ? "bot" : "human",
  };
};

export const getMetricStatus = (value: number): MetricStatus => {
  if (value >= 20) return "critical";
  if (value >= 10) return "warning";
  return "ok";
};

export const getMetricKey = (metric: MetricEvent): string => {
  return `${metric.project}:${metric.actor}:${metric.metric}`;
};

export const createMetricBatch = (
  changes: ClassifiedChange[],
  receivedAt: number,
  sampleWindowMs = SAMPLE_WINDOW_MS
): MetricEvent[] => {
  const counts = new Map<string, number>();

  changes.forEach(({ project, actor }) => {
    const key = `${project}:${actor}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return PROJECTS.flatMap((project) =>
    ACTORS.map((actor): MetricEvent => {
      const eventCount = counts.get(`${project}:${actor}`) ?? 0;
      const value = eventCount / (sampleWindowMs / 1_000);

      return {
        id: `${project}:${actor}:${receivedAt}`,
        project,
        actor,
        metric: "changes_per_second",
        unit: "changes/s",
        value,
        status: getMetricStatus(value),
        receivedAt,
      };
    })
  );
};

export const updateMetricHistory = (
  current: Map<string, MetricEvent[]>,
  batch: MetricEvent[],
  now: number,
  timeWindowMs: number,
  maxPoints = MAX_POINTS_PER_SERIES
): Map<string, MetricEvent[]> => {
  const timeThreshold = now - timeWindowMs;
  const next = new Map<string, MetricEvent[]>();

  current.forEach((history, key) => {
    const recentHistory = history
      .filter((event) => event.receivedAt >= timeThreshold)
      .slice(0, maxPoints - 1);

    if (recentHistory.length > 0) {
      next.set(key, recentHistory);
    }
  });

  batch.forEach((metric) => {
    const key = getMetricKey(metric);
    const history = next.get(key) ?? [];
    next.set(key, [metric, ...history].slice(0, maxPoints));
  });

  return next;
};

export const filterMetricHistory = (
  historyByKey: Map<string, MetricEvent[]>,
  filters: MetricFilters
): Map<string, MetricEvent[]> => {
  const visibleMetrics = new Map<string, MetricEvent[]>();

  historyByKey.forEach((history, key) => {
    const latestMetric = history[0];

    if (!latestMetric) return;

    const projectMatch =
      filters.project === "all" || filters.project === latestMetric.project;
    const actorMatch =
      filters.actor === "all" || filters.actor === latestMetric.actor;

    if (projectMatch && actorMatch) {
      visibleMetrics.set(key, history);
    }
  });

  return visibleMetrics;
};
