'use client';

import type { OpticalResponsePoint } from '@/types/solver';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

interface OpticalChartProps {
  data: OpticalResponsePoint[];
}

const chartConfig = {
  reflectance: {
    label: "Reflectance",
    color: "hsl(var(--chart-1))",
  },
  transmittance: {
    label: "Transmittance",
    color: "hsl(var(--chart-2))",
  },
};

export default function OpticalChart({ data }: OpticalChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Optical Response</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">No data to display. Please perform a calculation.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Optical Response</CardTitle>
        <CardDescription>Reflectance and Transmittance vs. Wavelength</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[400px] w-full">
          <LineChart
            accessibilityLayer
            data={data}
            margin={{
              top: 5,
              right: 20,
              left: 0,
              bottom: 5,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="wavelength"
              type="number"
              name="Wavelength"
              unit="nm"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={['dataMin', 'dataMax']}
            />
            <YAxis
              name="Intensity"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={[0, 1]}
              tickFormatter={(value) => value.toFixed(1)}
            />
            <ChartTooltip
              cursor={true}
              content={<ChartTooltipContent indicator="line" />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="reflectance"
              type="natural"
              stroke="var(--color-reflectance)"
              strokeWidth={2}
              dot={false}
              name="Reflectance"
            />
            <Line
              dataKey="transmittance"
              type="natural"
              stroke="var(--color-transmittance)"
              strokeWidth={2}
              dot={false}
              name="Transmittance"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
