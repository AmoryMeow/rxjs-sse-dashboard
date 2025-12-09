import { events$ } from "./services";
import { useObservable } from "./hooks";

function App() {
  const lastEvent = useObservable(events$, null);

  return (
    <div style={{ padding: 16 }}>
      <h1>RxJS SSE Demo</h1>
      {lastEvent ? (
        <div>
          <p>
            Last event at: {new Date(lastEvent.receivedAt).toLocaleTimeString()}
          </p>
          <pre>{lastEvent.raw}</pre>
        </div>
      ) : (
        <p>Waiting for events...</p>
      )}
    </div>
  );
}

export default App;
