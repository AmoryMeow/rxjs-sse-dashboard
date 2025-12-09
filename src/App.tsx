import { useMemo } from "react";
import { createLastEvents$ } from "./services";
import { useObservable } from "./hooks";

function App() {
  const lastEvents$ = useMemo(() => createLastEvents$(), []);
  const lastEvents = useObservable(lastEvents$, []);

  return (
    <div style={{ padding: 16 }}>
      <h1>RxJS SSE Demo</h1>
      <h2>Last events ({lastEvents.length})</h2>
      <ul>
        {lastEvents.map((event) => (
          <li key={event.id}>
            <strong>{new Date(event.receivedAt).toLocaleTimeString()}:</strong>
            <code>{event.raw}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
