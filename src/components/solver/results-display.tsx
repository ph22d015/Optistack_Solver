
'use client';

import type { CalculationResults } from '@/types/solver';
import OpticalChart from './optical-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Info, AlertTriangle, Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import html2canvas from 'html2canvas';
import { useToast } from "@/hooks/use-toast"; // Added toast import

interface ResultsDisplayProps {
  results: CalculationResults | null;
  isLoading: boolean;
}

const CHART_CONTAINER_ID = "optical-response-chart-container-for-download";

export default function ResultsDisplay({ results, isLoading }: ResultsDisplayProps) {
  const { toast } = useToast(); // Initialize toast
  const aiFeedback = results?.aiFeedback;
  const opticalData = results?.data;

  const handleDownloadChart = () => {
    const chartElement = document.getElementById(CHART_CONTAINER_ID);
    if (chartElement) {
      const computedBackgroundColor = getComputedStyle(chartElement).backgroundColor;

      html2canvas(chartElement, {
        backgroundColor: computedBackgroundColor || '#ffffff', // Use computed background or fallback to white
        useCORS: true,
        scale: 2,
        logging: true, // Enable html2canvas console logging
        onclone: (documentClone) => {
          // Attempt to fix SVG rendering issues by ensuring explicit dimensions
          // This is sometimes necessary for html2canvas to correctly capture SVGs.
          const svgs = documentClone.querySelectorAll('svg');
          svgs.forEach(svg => {
            const rect = svg.getBoundingClientRect();
            svg.setAttribute('width', `${rect.width}px`);
            svg.setAttribute('height', `${rect.height}px`);
            // It might be beneficial to inline styles here if complex CSS is used within SVGs
            // For now, explicit dimensions are a good first step.
          });
        }
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'optical_response_plot.jpg';
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link);
        toast({
          title: "Chart Downloaded",
          description: "The plot has been saved as optical_response_plot.jpg.",
        });
      }).catch(err => {
        console.error("Failed to download chart image. Error:", err);
        toast({
          title: "Download Failed",
          description: "Could not generate chart image. See console for details.",
          variant: "destructive",
        });
      });
    } else {
      console.warn(`Chart element with ID '${CHART_CONTAINER_ID}' not found for download.`);
      toast({
        title: "Download Error",
        description: `Chart element with ID '${CHART_CONTAINER_ID}' not found. Cannot download.`,
        variant: "destructive",
      });
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
