
'use client';

import React, { useState, useTransition } from 'react';
import InputForm from '@/components/solver/input-form';
import ResultsDisplay from '@/components/solver/results-display';
import type { SolverFormValues, CalculationResults } from '@/types/solver';
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
        const calculationOutput = await calculateOpticalResponse(data);
        
        setResults({ data: calculationOutput.data, sweepParameter: calculationOutput.sweepParameter });

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
        setResults({ 
            data: [], 
            sweepParameter: data.sweepType, 
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
            Define your optical stack parameters and calculate its response over wavelength or angle.
          </p>
        </div>
         <div className="relative aspect-[2/1] w-full max-w-4xl mx-auto rounded-lg overflow-hidden shadow-xl mb-12">
            <Image
                src="/optical_stack_diagram.png" 
                alt="Optical layers diagram"
                layout="fill"
                objectFit="contain" // Changed from "cover" to "contain"
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
