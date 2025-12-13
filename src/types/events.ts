export type Services = "payments" | "orders" | "auth";
export type Envs = "prod" | "test";

export interface MetricConfig {
  service: Services;
  env: Envs;
  metric: string;
  unit: string;
  baseValue: number;
  warningThreshold: number;
  criticalThreshold: number;
}

export type MetricStatus = "ok" | "warning" | "critical";
export interface MetricEvent extends MetricConfig {
  id: string;
  value: number;
  status: MetricStatus;
  receivedAt: number;
}

export interface MetricBatchConfig {
  type: "metric_batch";
  items: MetricConfig[];
}

export interface MetricFilters {
  service: Services | "all";
  env: Envs | "all";
}
