import { filter, map, mergeMap, scan, shareReplay } from "rxjs/operators";
import { BehaviorSubject, combineLatest, from, type Observable } from "rxjs";

import { createSseEventStream } from "./sseStream";
import type {
  MetricEvent,
  MetricConfig,
  MetricStatus,
  MetricBatchConfig,
  MetricFilters,
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

const filters$ = new BehaviorSubject<MetricFilters>({
  service: "all",
  env: "all",
});

const filteredMetrics$ = combineLatest([metrics$, filters$]).pipe(
  filter(([metric, filters]) => {
    const serviceMatch =
      filters.service === "all" || filters.service === metric.service;
    const envMatch = filters.env === "all" || filters.env === metric.env;

    return serviceMatch && envMatch;
  }),
  map(([metric]) => metric),
  shareReplay({ bufferSize: 1, refCount: true })
);

export const setFilters = (next: MetricFilters) => {
  filters$.next(next);
};

export const createLastMetrics$ = (
  timeWindowMs = 5 * 60 * 1000
): Observable<Map<string, MetricEvent[]>> => {
  return filteredMetrics$.pipe(
    scan<MetricEvent, Map<string, MetricEvent[]>>((acc, value) => {
      const key = getMetricKey(value);
      const history = acc.get(key) || [];
      const timeThreshold = Date.now() - timeWindowMs;

      const filteredHistory = history.filter(
        (event) => event.receivedAt >= timeThreshold
      );
      const newHistory = [value, ...filteredHistory];

      const newMap = new Map(acc);
      newMap.set(key, newHistory);
      return newMap;
    }, new Map())
  );
};
