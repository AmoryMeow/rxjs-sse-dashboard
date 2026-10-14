# Wikimedia Live Activity Dashboard

A real-time dashboard that visualizes activity across Wikipedia, Wikidata, and Wikimedia Commons. The application consumes Wikimedia's public Server-Sent Events stream, validates incoming messages, aggregates them with RxJS, and renders the resulting activity rates in React.

> **Project status:** This is a portfolio and educational project, not an official Wikimedia product or a production monitoring system. The events displayed by the dashboard are real and come from Wikimedia's public EventStreams service.

## Features

- Live data from [Wikimedia EventStreams](https://wikitech.wikimedia.org/wiki/EventStreams)
- Activity grouped by Wikimedia project and human or bot editor
- Five-second aggregation into changes per second
- Filters that update the visible series immediately
- Connection states for connecting, live, reconnecting, and paused
- Manual reconnect control and last-update timestamp
- Automatic stream pause while the browser tab is hidden
- Five-minute rolling history capped at 60 points per series
- Responsive Recharts visualization with animations disabled for sustained performance
- Unit and lifecycle tests for the metric pipeline and SSE connection

## How it works

1. The browser connects to Wikimedia EventStreams through `EventSource`.
2. Incoming JSON is validated and classified by project and actor type.
3. RxJS groups events into five-second samples and calculates changes per second.
4. The application stores a rolling metric history and applies the selected filters.
5. React and Recharts render the visible activity series.

The stream currently recognizes these projects:

- language-specific `*.wikipedia.org` domains as Wikipedia;
- `www.wikidata.org` as Wikidata;
- `commons.wikimedia.org` as Wikimedia Commons.

Other Wikimedia projects are ignored. Each sample contains separate human and bot series, including zero values, so chart lines remain continuous.

## Technology

- React 19
- TypeScript
- RxJS
- Recharts
- Vite
- Vitest
- ESLint

## Getting started

Install a current Node.js LTS release, then run:

```bash
npm install
npm run dev
```

Vite will print the local development URL in the terminal. The first chart sample appears after the five-second aggregation window completes.

## Configuration

The application uses the Wikimedia recent-change stream by default:

```text
https://stream.wikimedia.org/v2/stream/recentchange
```

Set `VITE_SSE_URL` in `.env.local` to use another endpoint:

```dotenv
VITE_SSE_URL=https://example.com/events
```

A replacement endpoint must support browser `EventSource`, allow the application's origin through CORS, and emit JSON messages containing `meta.domain` and an optional boolean `bot` field.

## Available scripts

- `npm run dev` starts the Vite development server.
- `npm run build` type-checks the project and creates a production build.
- `npm run preview` previews the production build locally.
- `npm run lint` runs ESLint.
- `npm test` runs the Vitest suite once.

## Testing

```bash
npm test
```

The test suite covers:

- valid and malformed Wikimedia payloads;
- project and actor classification;
- rate aggregation and status thresholds;
- rolling-window expiration and history limits;
- immediate filter changes without waiting for another event;
- EventSource connection, pause, error, and manual reconnect behavior.

Run the complete local verification before committing:

```bash
npm test
npm run lint
npm run build
```

## Project structure

- `src/chart` contains the Recharts visualization.
- `src/hooks` contains the React observable subscription hook.
- `src/services/metricDomain.ts` contains parsing, aggregation, filtering, and history rules.
- `src/services/sseService.ts` contains the RxJS metric pipeline.
- `src/services/sseStream.ts` manages EventSource and connection status.
- `src/types` contains shared domain types.
- `src/App.tsx` contains the dashboard UI and filters.

## Performance decisions

Wikimedia's recent-change stream can produce many events per second. The dashboard limits browser work by batching events for five seconds, emitting all six metric series in one update, retaining at most 60 points per series, disabling chart animations and point markers, and closing the connection while the tab is hidden.

## Current limitations

- Data is held in memory and resets on page reload.
- Activity thresholds are fixed at 10 and 20 changes per second.
- The dashboard depends on the availability of the public Wikimedia stream.
- Recharts currently causes a production bundle-size warning from Vite.

## Planned improvements

- Summary cards for total activity, human edits, and bot edits
- Configurable time ranges and activity thresholds
- Recent-event and activity-spike panels
- Public deployment with screenshots and a live-demo link
