
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
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Legend } from "recharts";

interface OpticalChartProps {
  data: OpticalResponsePoint[];
}

const chartConfig = {
  reflectance: {
    label: "Reflectance (R)",
    color: "hsl(var(--chart-1))",
  },
  transmittance: {
    label: "Transmittance (T)",
    color: "hsl(var(--chart-2))",
  },
  absorptance: {
    label: "Absorptance (A)",
    color: "hsl(var(--chart-3))", // Using chart-3 for absorptance
  },
  wavelength: {
    label: "Wavelength (nm)",
  }
};

export default function OpticalChart({ data }: OpticalChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="shadow-md">
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
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Optical Response</CardTitle>
        <CardDescription>Reflectance, Transmittance, and Absorptance vs. Wavelength</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[400px] w-full aspect-video">
          <LineChart
            accessibilityLayer
            data={data}
            margin={{
              top: 20, // Increased top margin for legend if placed above
              right: 30, // Increased right margin for labels
              left: 20,  // Increased left margin for Y-axis labels
              bottom: 20, // Increased bottom margin for X-axis labels and legend
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
              label={{ value: chartConfig.wavelength.label, position: 'insideBottom', offset: -15 }}
            />
            <YAxis
              type="number"
              name="Intensity"
              tickLine={false}
              axisLine={true}
              tickMargin={8}
              domain={[0, 1]}
              tickFormatter={(value) => value.toFixed(1)}
              label={{ value: 'Intensity (R, T, A)', angle: -90, position: 'insideLeft', offset: -10 }}
            />
            <ChartTooltip
              cursor={true}
              content={<ChartTooltipContent indicator="line" />}
            />
            <ChartLegend content={<ChartLegendContent verticalAlign="top" height={50} />} />
            <Line
              dataKey="reflectance"
              type="natural"
              stroke="var(--color-reflectance)"
              strokeWidth={2}
              dot={false}
              name={chartConfig.reflectance.label}
              
            />
            <Line
              dataKey="transmittance"
              type="natural"
              stroke="var(--color-transmittance)"
              strokeWidth={2}
              dot={false}
              name={chartConfig.transmittance.label}
            />
            <Line
              dataKey="absorptance"
              type="natural"
              stroke="var(--color-absorptance)"
              strokeWidth={2}
              dot={false}
              name={chartConfig.absorptance.label}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

