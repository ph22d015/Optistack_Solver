
'use client';

import React, { useState, useTransition, useRef } from 'react';
import type { RefObject } from 'react';
import InputForm from '@/components/solver/input-form';
import ResultsDisplay from '@/components/solver/results-display';
import type { SolverFormValues, CalculationResults } from '@/types/solver';
import { calculateOpticalResponse } from '@/lib/solver-calculations';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import type ReCAPTCHA from 'react-google-recaptcha'; // Import type
import { verifyRecaptchaToken } from './actions'; // Server Action

export default function HomePage() {
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  const handleFormSubmit = async (data: SolverFormValues) => {
    if (!siteKey) {
      // If siteKey is not configured, proceed without reCAPTCHA.
      // In a production app, you might want to be stricter and show an error or disable the form.
      console.warn("ReCAPTCHA site key not configured. Skipping verification.");
    } else {
      const token = recaptchaRef.current?.getValue();
      if (!token) {
        toast({ title: "ReCAPTCHA Required", description: "Please complete the reCAPTCHA.", variant: "destructive" });
        return; // Stop submission
      }

      setIsLoading(true); // Set loading before async verification
      const verification = await verifyRecaptchaToken(token);
      recaptchaRef.current?.reset(); // Reset reCAPTCHA after attempting verification

      if (!verification.success) {
        toast({ title: "ReCAPTCHA Failed", description: verification.message, variant: "destructive" });
        setIsLoading(false); // Reset loading
        return; // Stop submission
      }
      // If verification is successful, isLoading remains true for the calculation part.
    }

    // If reCAPTCHA is not configured OR verification was successful:
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
                objectFit="contain"
                priority
            />
        </div>
      </section>

      <Separator />

      <div className="space-y-8"> 
        <InputForm
          onSubmit={handleFormSubmit}
          isLoading={isLoading || isPending}
          recaptchaRef={recaptchaRef}
          recaptchaSiteKey={siteKey || ""} // Pass siteKey, default to empty string if undefined
        />
        <ResultsDisplay results={results} isLoading={isLoading || isPending} />
      </div>
    </div>
  );
}
