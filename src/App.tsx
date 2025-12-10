import { useMemo } from "react";

import { createLastMetrics$ } from "./services";
import { useObservable } from "./hooks";

function App() {
  const lastMetrics$ = useMemo(() => createLastMetrics$(), []);
  const lastMetrics = useObservable(lastMetrics$, []);

  return (
    <div>
      <h1>RxJS SSE Demo</h1>
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
    </div>
  );
}

export default App;
