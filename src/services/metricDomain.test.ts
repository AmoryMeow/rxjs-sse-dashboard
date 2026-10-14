import { BehaviorSubject, Subject } from "rxjs";
import { describe, expect, it } from "vitest";

import type { MetricEvent, MetricFilters } from "../types";
import {
  classifyRecentChange,
  createMetricBatch,
  getMetricKey,
  getMetricStatus,
  getProject,
  parseRecentChange,
  updateMetricHistory,
} from "./metricDomain";
import { createVisibleMetrics$ } from "./sseService";

const createMetric = (
  overrides: Partial<MetricEvent> = {}
): MetricEvent => ({
  id: "metric-1",
  project: "wikipedia",
  actor: "human",
  metric: "changes_per_second",
  unit: "changes/s",
  value: 1,
  status: "ok",
  receivedAt: 1_000,
  ...overrides,
});

describe("Wikimedia event parsing", () => {
  it("normalizes a valid event", () => {
    expect(
      parseRecentChange(
        JSON.stringify({
          bot: true,
          meta: { domain: "www.wikidata.org", ignored: "value" },
          title: "Q42",
        })
      )
    ).toEqual({
      bot: true,
      meta: { domain: "www.wikidata.org" },
    });
  });

  it.each([
    "not-json",
    "null",
    "{}",
    JSON.stringify({ meta: {} }),
    JSON.stringify({ meta: { domain: 42 } }),
    JSON.stringify({ meta: { domain: "en.wikipedia.org" }, bot: "yes" }),
  ])("rejects an invalid payload", (payload) => {
    expect(parseRecentChange(payload)).toBeNull();
  });

  it("classifies supported projects and actors", () => {
    expect(getProject("en.wikipedia.org")).toBe("wikipedia");
    expect(getProject("www.wikidata.org")).toBe("wikidata");
    expect(getProject("commons.wikimedia.org")).toBe("commons");
    expect(getProject("en.wikisource.org")).toBeNull();

    expect(
      classifyRecentChange({
        bot: false,
        meta: { domain: "ru.wikipedia.org" },
      })
    ).toEqual({ project: "wikipedia", actor: "human" });
  });
});

describe("metric aggregation", () => {
  it("creates one rate metric for every project and actor pair", () => {
    const batch = createMetricBatch(
      [
        { project: "wikipedia", actor: "human" },
        { project: "wikipedia", actor: "human" },
        { project: "wikidata", actor: "bot" },
      ],
      10_000,
      1_000
    );

    expect(batch).toHaveLength(6);
    expect(
      batch.find(
        (metric) =>
          metric.project === "wikipedia" && metric.actor === "human"
      )?.value
    ).toBe(2);
    expect(
      batch.find(
        (metric) => metric.project === "wikidata" && metric.actor === "bot"
      )?.value
    ).toBe(1);
    expect(
      batch.find(
        (metric) => metric.project === "commons" && metric.actor === "bot"
      )?.value
    ).toBe(0);
  });

  it("assigns activity statuses at their boundaries", () => {
    expect(getMetricStatus(9.99)).toBe("ok");
    expect(getMetricStatus(10)).toBe("warning");
    expect(getMetricStatus(20)).toBe("critical");
  });
});

describe("metric history", () => {
  it("drops expired series and limits points per series", () => {
    let history = new Map<string, MetricEvent[]>();

    for (let timestamp = 1; timestamp <= 5; timestamp += 1) {
      history = updateMetricHistory(
        history,
        [
          createMetric({
            id: String(timestamp),
            receivedAt: timestamp,
          }),
        ],
        timestamp,
        100,
        3
      );
    }

    const key = getMetricKey(createMetric());
    expect(history.get(key)?.map((metric) => metric.id)).toEqual([
      "5",
      "4",
      "3",
    ]);

    const expiredMetric = createMetric({
      id: "expired",
      project: "commons",
      receivedAt: 1,
    });
    history.set(getMetricKey(expiredMetric), [expiredMetric]);

    const cleaned = updateMetricHistory(history, [], 200, 100, 3);
    expect(cleaned.has(getMetricKey(expiredMetric))).toBe(false);
  });

  it("reapplies filters immediately without waiting for another batch", () => {
    const batches$ = new Subject<MetricEvent[]>();
    const filters$ = new BehaviorSubject<MetricFilters>({
      project: "all",
      actor: "all",
    });
    const sizes: number[] = [];
    const visibleProjects: string[][] = [];
    const subscription = createVisibleMetrics$(batches$, filters$, {
      now: () => 1_000,
    }).subscribe((history) => {
      sizes.push(history.size);
      visibleProjects.push(
        Array.from(history.values()).map((events) => events[0].project)
      );
    });

    batches$.next([
      createMetric(),
      createMetric({
        id: "metric-2",
        project: "commons",
      }),
    ]);
    filters$.next({ project: "wikipedia", actor: "all" });

    expect(sizes).toEqual([2, 1]);
    expect(visibleProjects.at(-1)).toEqual(["wikipedia"]);

    subscription.unsubscribe();
  });
});
