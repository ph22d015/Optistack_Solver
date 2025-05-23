
'use client';

import React, { useState, useTransition } from 'react';
import InputForm from '@/components/solver/input-form';
import ResultsDisplay from '@/components/solver/results-display';
import type { SolverFormValues, CalculationResults, AiFeedback } from '@/types/solver';
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

  const handleValidate = async (data: SolverFormValues): Promise<AiFeedback | null> => {
    try {
      // Map SolverFormValues to the structure expected by performAiValidation
      const aiValidationInput = {
        incidentMediumRefractiveIndex: data.incidentMediumRefractiveIndex,
        substrateMediumRefractiveIndex: data.substrateMediumRefractiveIndex,
        numLayers: data.numLayers,
        thickness: data.thickness.map(t => Number(t)),
        refractiveIndex: data.refractiveIndex.map(ri => ({
          n: Number(ri.n),
          k: Number(ri.k),
        })),
        angleOfIncidence: Number(data.angleOfIncidence),
        polarization: data.polarization,
        minWavelength: Number(data.minWavelength),
        maxWavelength: Number(data.maxWavelength),
      };
      const feedback = await performAiValidation(aiValidationInput);
      return feedback;
    } catch (error) {
      console.error("Validation error:", error);
      toast({
        title: "AI Validation Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleSubmit = async (data: SolverFormValues) => {
    setIsLoading(true);
    setResults(null); 
    
    startTransition(async () => {
      try {
        // Prepare data for AI validation
        const aiValidationInput = {
            incidentMediumRefractiveIndex: data.incidentMediumRefractiveIndex,
            substrateMediumRefractiveIndex: data.substrateMediumRefractiveIndex,
            numLayers: data.numLayers,
            thickness: data.thickness.map(t => Number(t)),
            refractiveIndex: data.refractiveIndex.map(ri => ({
                n: Number(ri.n),
                k: Number(ri.k)
            })),
            angleOfIncidence: Number(data.angleOfIncidence),
            polarization: data.polarization,
            minWavelength: Number(data.minWavelength),
            maxWavelength: Number(data.maxWavelength),
        };
        const aiFeedback = await performAiValidation(aiValidationInput);

        // Pass the full 'data' object which now includes all necessary fields
        const opticalData = await calculateOpticalResponse(data);
        setResults({ data: opticalData, aiFeedback });

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
        setResults({ data: [], aiFeedback: { warnings: ["Calculation failed: " + (error instanceof Error ? error.message : String(error))], suggestions: [] } });
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
            Define your optical stack parameters, including surrounding media, calculate its response, and visualize the results.
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-2">
          <InputForm 
            onSubmit={handleSubmit} 
            onValidate={handleValidate} 
            isLoading={isLoading || isPending}
          />
        </div>
        <div className="lg:col-span-3">
          <ResultsDisplay results={results} isLoading={isLoading || isPending} />
        </div>
      </div>
    </div>
  );
}
