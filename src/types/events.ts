export type Project = "wikipedia" | "wikidata" | "commons";
export type Actor = "human" | "bot";

export interface MetricEvent {
  id: string;
  project: Project;
  actor: Actor;
  metric: string;
  unit: string;
  value: number;
  status: MetricStatus;
  receivedAt: number;
}

export type MetricStatus = "ok" | "warning" | "critical";

export interface MetricFilters {
  project: Project | "all";
  actor: Actor | "all";
}
