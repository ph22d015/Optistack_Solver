
'use client';

import type { CalculationResults } from '@/types/solver';
import OpticalChart from './optical-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// Alert related imports are removed
import { Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";

interface ResultsDisplayProps {
  results: CalculationResults | null;
  isLoading: boolean;
}

export default function ResultsDisplay({ results, isLoading }: ResultsDisplayProps) {
  const { toast } = useToast();
  // aiFeedback is removed
  const opticalData = results?.data;
  const sweepParameter = results?.sweepParameter ?? 'wavelength'; // Default to wavelength if not present

  const handleDownloadCsv = () => {
    if (!opticalData || opticalData.length === 0) {
      toast({
        title: "No Data",
        description: "There is no simulation data to download.",
        variant: "default",
      });
      return;
    }

    let csvContent = "";
    let filename = "optical_response_data.csv";

    // Header row
    if (sweepParameter === 'wavelength') {
      csvContent += "Wavelength (nm),Reflectance,Transmittance,Absorptance\n";
    } else { // angle
      csvContent += "Angle (deg),Reflectance,Transmittance,Absorptance\n";
    }

    // Data rows
    opticalData.forEach(point => {
      const row = [
        point.xValue.toFixed(4),
        point.reflectance.toFixed(4),
        point.transmittance.toFixed(4),
        point.absorptance.toFixed(4)
      ].join(',');
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { // Feature detection
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "Download Started",
        description: "Your CSV data has started downloading.",
      });
    } else {
      toast({
        title: "Download Failed",
        description: "CSV download is not supported by your browser.",
        variant: "destructive",
      });
    }
  };


  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Results</CardTitle>
          <CardDescription>Calculated optical response.</CardDescription> {/* AI feedback part removed */}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadCsv}
          disabled={isLoading || !opticalData || opticalData.length === 0}
          aria-label="Download simulation data as CSV"
        >
          <Download className="mr-2 h-4 w-4" />
          Download Data (CSV)
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        )}

        {/* AI Feedback Alert section is removed */}

        {!isLoading && opticalData && <OpticalChart data={opticalData} sweepParameter={sweepParameter} />}
        
        {!isLoading && !opticalData && ( // Condition simplified
          <p className="text-muted-foreground text-center py-10">
            Enter parameters and click "Calculate" to see results.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
