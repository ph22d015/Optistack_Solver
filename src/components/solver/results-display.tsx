'use client';

import type { CalculationResults, AiFeedback, OpticalResponsePoint } from '@/types/solver';
import OpticalChart from './optical-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ResultsDisplayProps {
  results: CalculationResults | null;
  isLoading: boolean;
}

export default function ResultsDisplay({ results, isLoading }: ResultsDisplayProps) {
  const aiFeedback = results?.aiFeedback;
  const opticalData = results?.data;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <CardDescription>Calculated optical response and AI feedback.</CardDescription>
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

        {!isLoading && opticalData && <OpticalChart data={opticalData} />}
        
        {!isLoading && !opticalData && !aiFeedback && (
          <p className="text-muted-foreground text-center py-10">
            Enter parameters and click "Calculate" to see results.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
