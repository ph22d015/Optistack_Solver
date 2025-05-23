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
      const aiInput = {
        numLayers: data.numLayers,
        thickness: data.thickness.map(t => Number(t)),
        refractiveIndex: data.refractiveIndex.map(ri => Number(ri)),
        angleOfIncidence: Number(data.angleOfIncidence),
        polarization: data.polarization,
      };
      const feedback = await performAiValidation(aiInput);
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
    setResults(null); // Clear previous results
    
    startTransition(async () => {
      try {
        // AI Validation is now part of the InputForm's submit flow,
        // but we can still get the latest feedback if needed or re-validate.
        // For this flow, we'll assume InputForm has handled displaying initial AI feedback.
        // The feedback from onValidate in InputForm is used there.
        // Here we call it again to ensure we have it for the results display if necessary,
        // or we could pass it up from InputForm.
        const aiInput = {
            numLayers: data.numLayers,
            thickness: data.thickness.map(t => Number(t)),
            refractiveIndex: data.refractiveIndex.map(ri => Number(ri)),
            angleOfIncidence: Number(data.angleOfIncidence),
            polarization: data.polarization,
        };
        const aiFeedback = await performAiValidation(aiInput);

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
        setResults({ data: [], aiFeedback: { warnings: ["Calculation failed."], suggestions: [] } });
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
            Define your optical stack parameters, calculate its response, and visualize the results.
            Our AI assistant helps prevent errors and suggests optimal configurations.
          </p>
        </div>
         <div className="relative aspect-[2/1] w-full max-w-4xl mx-auto rounded-lg overflow-hidden shadow-xl mb-12">
            <Image 
                src="https://placehold.co/1200x600.png" 
                alt="Optical layers abstract representation" 
                layout="fill"
                objectFit="cover"
                data-ai-hint="optics light"
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
