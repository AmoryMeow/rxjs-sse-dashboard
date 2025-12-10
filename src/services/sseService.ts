import { map, mergeMap, scan, shareReplay } from "rxjs/operators";
import { from, type Observable } from "rxjs";

import { createSseEventStream } from "./sseStream";
import type {
  MetricEvent,
  MetricConfig,
  MetricStatus,
  MetricBatchConfig,
} from "../types";

const raw$ = createSseEventStream();

const baseMetric$: Observable<MetricConfig> = raw$.pipe(
  map((event) => JSON.parse(event.data) as MetricBatchConfig),

  mergeMap((data) => {
    const configs: MetricConfig[] = data.items.map((item) => ({
      service: item.service ?? "unknown",
      env: item.env ?? "prod",
      metric: item.metric ?? "unknown_metric",
      unit: item.unit ?? "count",
      baseValue: item.baseValue ?? 0.5,
      warningThreshold: item.warningThreshold ?? 1,
      criticalThreshold: item.criticalThreshold ?? 3,
    }));

    return from(configs);
  })
);

const getMetricKey = (config: MetricConfig): string => {
  return `${config.service}:${config.env}:${config.metric}`;
};

export const metrics$: Observable<MetricEvent> = baseMetric$.pipe(
  scan<MetricConfig, { state: Map<string, MetricEvent>; event: MetricEvent }>(
    (acc, config) => {
      const metricKey = getMetricKey(config);
      const prevEvent = acc.state.get(metricKey);
      const prevValue = prevEvent?.value ?? config.baseValue;

      // Emulate different metric values from backend:
      // - Mean reversion: values tend to return to baseValue
      // - Random fluctuations: simulate normal metric variations
      // - Occasional spikes: simulate sudden load changes or issues
      const meanReversion = (config.baseValue - prevValue) * 0.05;

      const randomChange =
        (Math.random() + Math.random() + Math.random() - 1.5) * 0.3;

      let spike = 0;
      if (Math.random() < 0.15) {
        const spikeMagnitude = Math.random() * 2;
        spike = Math.random() < 0.5 ? spikeMagnitude : -spikeMagnitude * 0.3;
      }

      let value = prevValue + meanReversion + randomChange + spike;
      if (value < 0) value = 0;

      let status: MetricStatus = "ok";
      if (value >= config.criticalThreshold) {
        status = "critical";
      } else if (value >= config.warningThreshold) {
        status = "warning";
      }

      const event: MetricEvent = {
        ...config,
        id: crypto.randomUUID(),
        value,
        status,
        receivedAt: Date.now(),
      };

      const newState = new Map(acc.state);
      newState.set(metricKey, event);

      return { state: newState, event };
    },
    { state: new Map(), event: {} as MetricEvent }
  ),
  map((acc) => acc.event),
  shareReplay({ bufferSize: 1, refCount: true })
);

export const createLastMetrics$ = (limit = 30): Observable<MetricEvent[]> => {
  return metrics$.pipe(
    scan<MetricEvent, MetricEvent[]>((acc, value) => {
      return [value, ...acc].slice(0, limit);
    }, [])
  );
};
