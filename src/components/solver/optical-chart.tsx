
'use client';

import type { OpticalResponsePoint, SweepParameter } from '@/types/solver';
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
  sweepParameter: SweepParameter;
}

const getChartConfig = (sweepParameter: SweepParameter) => ({
  reflectance: {
    label: "Reflectance (R)",
    color: "red", // Hardcoded for now
  },
  transmittance: {
    label: "Transmittance (T)",
    color: "green", // Hardcoded for now
  },
  absorptance: {
    label: "Absorptance (A)",
    color: "blue", // Hardcoded for now
  },
  xValue: {
    label: sweepParameter === 'wavelength' ? "Wavelength (nm)" : "Angle (°)",
  }
});

export default function OpticalChart({ data, sweepParameter }: OpticalChartProps) {
  const chartConfig = getChartConfig(sweepParameter);

  if (!data || data.length === 0) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Optical Response</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">No data to display. Please perform a calculation.</p>
        </CardContent>
      </Card>
    );
  }

  const xAxisLabel = chartConfig.xValue.label;
  const xAxisUnit = sweepParameter === 'wavelength' ? "nm" : "°";

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Optical Response</CardTitle>
        <CardDescription>Reflectance, Transmittance, and Absorptance vs. {xAxisLabel}</CardDescription>
      </CardHeader>
      <CardContent className="min-h-[400px] w-full bg-card p-4 rounded-md">
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={data}
            margin={{
              top: 60,
              right: 30,
              left: 20,
              bottom: 50,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="xValue"
              type="number"
              name={xAxisLabel} // Used by tooltip content internally if no labelFormatter
              unit={xAxisUnit}
              tickLine={false}
              axisLine={true}
              tickMargin={8}
              domain={['dataMin', 'dataMax']}
              label={{ value: xAxisLabel, position: 'bottom', offset: 10 }}
            />
            <YAxis
              type="number"
              name="Spectrum" 
              tickLine={false}
              axisLine={true}
              tickMargin={8}
              domain={[0, 1]}
              tickFormatter={(value) => value.toFixed(1)}
              label={{ value: 'Spectrum (R,T,A)', angle: -90, position: 'insideLeft', offset: -10 }}
            />
            <ChartTooltip
              cursor={true}
              content={
                <ChartTooltipContent 
                  indicator="line" 
                  labelFormatter={(value, payload) => {
                    // 'value' here is the xValue (wavelength or angle)
                    if (typeof value === 'number') {
                      return `${xAxisLabel}: ${value.toFixed(2)} ${xAxisUnit}`;
                    }
                    return `${xAxisLabel}: ${String(value)} ${xAxisUnit}`; 
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
              dataKey="reflectance"
              type="natural"
              stroke={chartConfig.reflectance.color} 
              strokeWidth={2}
              dot={false}
              name={chartConfig.reflectance.label}
            />
            <Line
              dataKey="transmittance"
              type="natural"
              stroke={chartConfig.transmittance.color}
              strokeWidth={2}
              dot={false}
              name={chartConfig.transmittance.label}
            />
            <Line
              dataKey="absorptance"
              type="natural"
              stroke={chartConfig.absorptance.color}
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
