import { useMemo, useState } from "react";

import { createLastMetrics$, setFilters } from "./services";
import { useObservable } from "./hooks";
import type { Actor, MetricFilters, Project } from "./types";
import { MetricChart } from "./chart";

const initialFilters: MetricFilters = {
  project: "all",
  actor: "all",
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

  return (
    <div>
      <h1>Wikimedia Live Activity</h1>
      <p>Real-time changes from Wikimedia EventStreams</p>
      <section>
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
      <section>
        <h2>Activity ({lastMetricsMap.size} series)</h2>
        <MetricChart title="Changes per second" data={lastMetricsMap} />
      </section>
    </div>
  );
}

export default App;
