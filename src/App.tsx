import { useMemo, useState } from "react";

import { createLastMetrics$, setFilters } from "./services";
import { useObservable } from "./hooks";
import type { Envs, MetricFilters, Services } from "./types";

const initialFilters: MetricFilters = {
  service: "all",
  env: "all",
};

function App() {
  const [filtersState, setFiltersState] =
    useState<MetricFilters>(initialFilters);

  const lastMetrics$ = useMemo(() => createLastMetrics$(), []);
  const lastMetricsMap = useObservable(lastMetrics$, new Map());

  const handleFilterChange = (data: Partial<MetricFilters>) => {
    const newFilters = { ...filtersState, ...data };
    setFiltersState(newFilters);
    setFilters(newFilters);
  };

  const lastMetrics = Array.from(lastMetricsMap.values()).flat();

  return (
    <div>
      <h1>RxJS SSE Demo</h1>
      <section>
        <select
          value={filtersState.service}
          onChange={(e) =>
            handleFilterChange({ service: e.target.value as Services })
          }
        >
          <option value="all">All</option>
          <option value="payments">Payments</option>
          <option value="orders">Orders</option>
          <option value="auth">Auth</option>
        </select>
        <select
          value={filtersState.env}
          onChange={(e) => handleFilterChange({ env: e.target.value as Envs })}
        >
          <option value="all">All</option>
          <option value="prod">Prod</option>
          <option value="test">Test</option>
        </select>
      </section>
      <section>
        <h2>Last events ({lastMetrics.length})</h2>
        <ul>
          {lastMetrics.map((metric) => (
            <li key={metric.id}>
              {new Date(metric.receivedAt).toLocaleTimeString()} -{" "}
              {metric.service}:{metric.env} - {metric.metric} -{" "}
              {metric.value.toFixed(2)} {metric.unit} - {metric.status}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default App;
