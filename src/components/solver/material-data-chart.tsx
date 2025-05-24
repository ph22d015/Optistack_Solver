
'use client';

import type { DispersiveDataPoint } from '@/types/solver';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer } from "recharts";

interface MaterialDataChartProps {
  data: DispersiveDataPoint[];
  materialName: string;
}

const chartConfig = {
  n: {
    label: "Refractive Index (n)",
    color: "hsl(var(--chart-1))", // Typically blueish
  },
  k: {
    label: "Extinction Coefficient (k)",
    color: "hsl(var(--chart-2))", // Typically greenish or reddish
  },
  wavelength: {
    label: "Wavelength (nm)",
  }
};

export default function MaterialDataChart({ data, materialName }: MaterialDataChartProps) {
  if (!data || data.length < 2) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <p className="text-muted-foreground">Not enough data points to plot for {materialName}.</p>
      </div>
    );
  }

  const yDomainN = [
    Math.min(...data.map(p => p.n)) - 0.1,
    Math.max(...data.map(p => p.n)) + 0.1,
  ];
  const yDomainK = [
    Math.min(...data.map(p => p.k)) - 0.01, // k values are often small
    Math.max(...data.map(p => p.k)) + 0.01,
  ];

  // Ensure domain min is not greater than domain max
  if (yDomainN[0] >= yDomainN[1]) yDomainN[1] = yDomainN[0] + 0.2;
  if (yDomainK[0] >= yDomainK[1]) yDomainK[1] = yDomainK[0] + 0.02;


  return (
    <div className="w-full">
      <ChartContainer config={chartConfig} className="min-h-[400px] w-full">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={data}
            margin={{
              top: 20,
              right: 40, // Increased right margin for YAxis label
              left: 20,
              bottom: 40,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="wavelength"
              type="number"
              name={chartConfig.wavelength.label}
              unit="nm"
              tickLine={false}
              axisLine={true}
              tickMargin={8}
              domain={['dataMin', 'dataMax']}
              label={{ value: chartConfig.wavelength.label, position: 'bottom', offset: 10 }}
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              dataKey="n"
              type="number"
              name={chartConfig.n.label}
              tickLine={false}
              axisLine={true}
              tickMargin={8}
              domain={yDomainN as [number, number]} // Ensure domain is appropriate for n
              tickFormatter={(value) => typeof value === 'number' ? value.toFixed(2) : value}
              label={{ value: chartConfig.n.label, angle: -90, position: 'insideLeft', offset: -5 }}
              stroke={chartConfig.n.color}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              dataKey="k"
              type="number"
              name={chartConfig.k.label}
              tickLine={false}
              axisLine={true}
              tickMargin={8}
              domain={yDomainK as [number, number]} // Ensure domain is appropriate for k
              tickFormatter={(value) => typeof value === 'number' ? value.toFixed(3) : value}
              label={{ value: chartConfig.k.label, angle: -90, position: 'insideRight', offset: -15 }}
              stroke={chartConfig.k.color}
            />
            <ChartTooltip
              cursor={true}
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(value) => {
                    if (typeof value === 'number') {
                      return `${chartConfig.wavelength.label}: ${value.toFixed(2)} nm`;
                    }
                    return `${chartConfig.wavelength.label}: ${String(value)} nm`;
                  }}
                />
              }
            />
            <ChartLegend
              verticalAlign="top"
              align="center"
              content={<ChartLegendContent />}
            />
            <Line
              yAxisId="left"
              dataKey="n"
              type="monotone"
              stroke={chartConfig.n.color}
              strokeWidth={2}
              dot={false}
              name={chartConfig.n.label}
            />
            <Line
              yAxisId="right"
              dataKey="k"
              type="monotone"
              stroke={chartConfig.k.color}
              strokeWidth={2}
              dot={false}
              name={chartConfig.k.label}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
