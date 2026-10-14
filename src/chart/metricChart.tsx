import {
  LineChart,
  Line,
  YAxis,
  XAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";

import type { MetricEvent } from "../types";

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#8dd1e1",
  "#d084d0",
  "#ffb347",
  "#87ceeb",
];

export const MetricChart = ({
  title,
  data,
}: {
  title: string;
  data: Map<string, MetricEvent[]>;
}) => {
  const { chartData, metricKeys } = useMemo(() => {
    if (data.size === 0) {
      return { chartData: [], metricKeys: [] };
    }

    const timeSet = new Set<number>();
    data.forEach((events) => {
      events.forEach((event) => {
        timeSet.add(event.receivedAt);
      });
    });

    const sortedTimes = Array.from(timeSet).sort((a, b) => a - b);
    const metricKeys = Array.from(data.keys());

    const chartData = sortedTimes.map((timestamp) => {
      const point: Record<string, string | number> = {
        time: new Date(timestamp).toLocaleTimeString(),
        timestamp,
      };

      data.forEach((events, key) => {
        const event = events.find((e) => e.receivedAt === timestamp);
        if (event) {
          point[key] = Number(event.value.toFixed(2));
        }
      });

      return point;
    });

    return { chartData, metricKeys };
  }, [data]);

  if (metricKeys.length === 0) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        No data available
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "400px", marginBottom: "20px" }}>
      {title && <h3>{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            angle={-45}
            textAnchor="end"
            height={80}
            interval="preserveStartEnd"
          />
          <YAxis />
          <Tooltip />
          <Legend />
          {metricKeys.map((key, index) => {
            const events = data.get(key);
            if (!events || events.length === 0) return null;
            const firstEvent = events[0];
            const metricName = `${firstEvent.project}:${firstEvent.actor}`;
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                name={metricName}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
