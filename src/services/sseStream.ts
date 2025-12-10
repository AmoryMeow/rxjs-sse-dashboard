import { Observable } from "rxjs";

const buildSseUrl = () => {
  const json = {
    type: "metric_batch",
    items: [
      {
        type: "metric",
        service: "payments",
        env: "prod",
        metric: "error_rate_5m",
        unit: "percent",
        baseValue: 0.5,
        warningThreshold: 1,
        criticalThreshold: 3,
      },
      {
        service: "orders",
        env: "prod",
        metric: "requests_per_second",
        unit: "req/s",
        baseValue: 100,
        warningThreshold: 500,
        criticalThreshold: 1000,
      },
    ],
  };

  const params = new URLSearchParams({
    interval: "5",
    jsonobj: JSON.stringify(json),
  });

  return `https://sse.dev/test?${params.toString()}`;
};

export const createSseEventStream = (): Observable<MessageEvent> => {
  return new Observable<MessageEvent>((subscriber) => {
    const url = buildSseUrl();
    const source = new EventSource(url);

    source.onmessage = (event) => {
      subscriber.next(event);
    };

    source.onerror = (error) => {
      subscriber.error(error);
    };

    return () => {
      source.close();
    };
  });
};
