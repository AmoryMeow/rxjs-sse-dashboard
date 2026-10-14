import { useMemo, useState } from "react";

import {
  connectionStatus$,
  createLastMetrics$,
  reconnectSse,
  setFilters,
} from "./services";
import { useObservable } from "./hooks";
import type { SseConnectionStatus } from "./services";
import type { Actor, MetricFilters, Project } from "./types";
import { MetricChart } from "./chart";
import "./App.css";

const initialFilters: MetricFilters = {
  project: "all",
  actor: "all",
};

const statusLabels: Record<SseConnectionStatus, string> = {
  connecting: "Connecting",
  connected: "Live",
  reconnecting: "Reconnecting",
  paused: "Paused",
};

function App() {
  const [filtersState, setFiltersState] =
    useState<MetricFilters>(initialFilters);

  const lastMetrics$ = useMemo(() => createLastMetrics$(), []);
  const lastMetricsMap = useObservable(lastMetrics$, new Map());
  const connectionStatus = useObservable(connectionStatus$, "connecting");

  const lastUpdatedAt = useMemo(() => {
    let latestTimestamp = 0;

    lastMetricsMap.forEach((history) => {
      latestTimestamp = Math.max(
        latestTimestamp,
        history[0]?.receivedAt ?? 0
      );
    });

    return latestTimestamp;
  }, [lastMetricsMap]);

  const handleFilterChange = (data: Partial<MetricFilters>) => {
    const newFilters = { ...filtersState, ...data };
    setFiltersState(newFilters);
    setFilters(newFilters);
  };

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Wikimedia Live Activity</h1>
          <p>Real-time changes from Wikimedia EventStreams</p>
        </div>
        <div className="connection-panel" aria-live="polite">
          <span className="connection-status" data-status={connectionStatus}>
            {statusLabels[connectionStatus]}
          </span>
          <span className="last-updated">
            Last update: {" "}
            {lastUpdatedAt
              ? new Date(lastUpdatedAt).toLocaleTimeString()
              : "waiting for data"}
          </span>
          <button type="button" onClick={reconnectSse}>
            Reconnect
          </button>
        </div>
      </header>
      <section className="filters" aria-label="Activity filters">
        <label>
          Project{" "}
          <select
            value={filtersState.project}
            onChange={(e) =>
              handleFilterChange({ project: e.target.value as Project })
            }
          >
            <option value="all">All</option>
            <option value="wikipedia">Wikipedia</option>
            <option value="wikidata">Wikidata</option>
            <option value="commons">Commons</option>
          </select>
        </label>
        <label>
          Editor{" "}
          <select
            value={filtersState.actor}
            onChange={(e) =>
              handleFilterChange({ actor: e.target.value as Actor })
            }
          >
            <option value="all">All</option>
            <option value="human">Human</option>
            <option value="bot">Bot</option>
          </select>
        </label>
      </section>
      <section className="activity-section">
        <h2>Activity ({lastMetricsMap.size} series)</h2>
        {lastMetricsMap.size > 0 ? (
          <MetricChart title="Changes per second" data={lastMetricsMap} />
        ) : (
          <div className="stream-state" role="status">
            {connectionStatus === "connected"
              ? "Connected. Waiting for the first data sample…"
              : `${statusLabels[connectionStatus]}…`}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
