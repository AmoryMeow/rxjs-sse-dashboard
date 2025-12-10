export interface MetricConfig {
  service: string;
  env: string;
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
