
'use client';

import type { CalculationResults } from '@/types/solver';
import OpticalChart from './optical-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Info, AlertTriangle, Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import html2canvas from 'html2canvas';

interface ResultsDisplayProps {
  results: CalculationResults | null;
  isLoading: boolean;
}

const CHART_CONTAINER_ID = "optical-response-chart-container-for-download";

export default function ResultsDisplay({ results, isLoading }: ResultsDisplayProps) {
  const aiFeedback = results?.aiFeedback;
  const opticalData = results?.data;

  const handleDownloadChart = () => {
    const chartElement = document.getElementById(CHART_CONTAINER_ID);
    if (chartElement) {
      html2canvas(chartElement, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#ffffff', // Use card bg for canvas
        useCORS: true, // If chart ever uses external images/fonts
        scale: 2, // Increase resolution
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'optical_response_plot.jpg';
        link.href = canvas.toDataURL('image/jpeg', 0.9); // Quality 0.9
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link);
      }).catch(err => {
        console.error("Error generating chart image:", err);
        // Optionally, inform the user with a toast
      });
    } else {
      console.warn("Chart element not found for download.");
      // Optionally, inform the user
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Results</CardTitle>
          <CardDescription>Calculated optical response and AI feedback.</CardDescription>
        </div>
        {opticalData && opticalData.length > 0 && !isLoading && (
          <Button onClick={handleDownloadChart} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Download Plot
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        )}

        {!isLoading && aiFeedback && (aiFeedback.warnings.length > 0 || aiFeedback.suggestions.length > 0) && (
          <Alert variant={aiFeedback.warnings.length > 0 ? "destructive" : "default"}>
            {aiFeedback.warnings.length > 0 ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
            <AlertTitle>{aiFeedback.warnings.length > 0 ? "AI Validation Warnings" : "AI Suggestions"}</AlertTitle>
            <AlertDescription>
              {aiFeedback.warnings.map((warning, i) => <p key={`warn-res-${i}`}>{warning}</p>)}
              {aiFeedback.suggestions.map((suggestion, i) => <p key={`sugg-res-${i}`}>{suggestion}</p>)}
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && opticalData && <OpticalChart data={opticalData} chartId={CHART_CONTAINER_ID} />}
        
        {!isLoading && !opticalData && !aiFeedback && (
          <p className="text-muted-foreground text-center py-10">
            Enter parameters and click "Calculate" to see results.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
