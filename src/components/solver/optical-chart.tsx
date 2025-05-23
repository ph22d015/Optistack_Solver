
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
    label: "Reflectance (R)",
    color: "hsl(var(--chart-1))", // Red
  },
  transmittance: {
    label: "Transmittance (T)",
    color: "hsl(var(--chart-2))", // Green
  },
  absorptance: {
    label: "Absorptance (A)",
    color: "hsl(var(--chart-3))", // Blue
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
        <div className="min-h-[400px] w-full aspect-video bg-card p-4 rounded-md">
          <ChartContainer
            config={chartConfig}
          >
            <LineChart
              accessibilityLayer
              data={data}
              margin={{
                top: 35, 
                right: 30,
                left: 20,
                bottom: 35, // Increased bottom margin
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
                label={{ value: chartConfig.wavelength.label, position: 'insideBottom', offset: -20 }} // Adjusted offset for label
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
                    nameKey="name" 
                    labelFormatter={(_label, payload) => {
                      if (payload && payload.length > 0 && payload[0].payload) {
                        return `Wavelength: ${payload[0].payload.wavelength.toFixed(2)} nm`;
                      }
                      return "";
                    }}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent verticalAlign="top" height={50} />} />
              <Line
                dataKey="reflectance"
                type="natural"
                stroke="red" 
                strokeWidth={2}
                dot={false}
                name={chartConfig.reflectance.label}
              />
              <Line
                dataKey="transmittance"
                type="natural"
                stroke="green"
                strokeWidth={2}
                dot={false}
                name={chartConfig.transmittance.label}
              />
              <Line
                dataKey="absorptance"
                type="natural"
                stroke="blue"
                strokeWidth={2}
                dot={false}
                name={chartConfig.absorptance.label}
              />
            </LineChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
