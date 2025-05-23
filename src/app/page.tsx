
'use client';

import React, { useState, useTransition } from 'react';
import InputForm from '@/components/solver/input-form';
import ResultsDisplay from '@/components/solver/results-display';
import type { SolverFormValues, CalculationResults, AiFeedback, SweepParameter } from '@/types/solver';
import { performAiValidation } from '@/app/actions';
import { calculateOpticalResponse } from '@/lib/solver-calculations';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

export default function HomePage() {
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSubmit = async (data: SolverFormValues) => {
    setIsLoading(true);
    setResults(null);

    startTransition(async () => {
      try {
        // AI Validation input mapping is now direct as SolverFormValues matches ValidateInputParametersInput structure
        const aiFeedback = await performAiValidation(data);
        
        // The calculateOpticalResponse now returns an object { data: OpticalResponsePoint[], sweepParameter: SweepParameter }
        const calculationOutput = await calculateOpticalResponse(data);
        
        setResults({ data: calculationOutput.data, sweepParameter: calculationOutput.sweepParameter, aiFeedback });

        toast({
          title: "Calculation Complete",
          description: "Optical response has been calculated.",
        });
      } catch (error) {
        console.error("Calculation error:", error);
        toast({
          title: "Calculation Error",
          description: error instanceof Error ? error.message : "An unexpected error occurred during calculation.",
          variant: "destructive",
        });
        // Ensure sweepParameter is provided even on error for chart consistency
        setResults({ 
            data: [], 
            sweepParameter: data.sweepType, // Use sweepType from form data as fallback
            aiFeedback: { warnings: ["Calculation failed: " + (error instanceof Error ? error.message : String(error))], suggestions: [] } 
        });
      } finally {
        setIsLoading(false);
      }
    });
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="intro-title">
        <div className="text-center mb-8">
          <h2 id="intro-title" className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            Simulate Multilayer Optical Stacks
          </h2>
          <p className="mt-4 text-lg leading-8 text-foreground/80">
            Define your optical stack parameters, calculate its response over wavelength or angle, and visualize the results.
            Our AI assistant helps prevent errors and suggests optimal configurations.
          </p>
        </div>
         <div className="relative aspect-[2/1] w-full max-w-4xl mx-auto rounded-lg overflow-hidden shadow-xl mb-12">
            <Image
                src="https://placehold.co/1200x600.png"
                alt="Optical layers abstract representation"
                layout="fill"
                objectFit="cover"
                data-ai-hint="optics lightwave"
                priority
            />
        </div>
      </section>

      <Separator />

      <div className="space-y-8"> 
        <InputForm
          onSubmit={handleSubmit}
          isLoading={isLoading || isPending}
        />
        <ResultsDisplay results={results} isLoading={isLoading || isPending} />
      </div>
    </div>
  );
}
