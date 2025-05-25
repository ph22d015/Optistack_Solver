
'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import InputForm from '@/components/solver/input-form';
import ResultsDisplay from '@/components/solver/results-display';
import type { SolverFormValues, CalculationResults, SavedSimulationEntry } from '@/types/solver';
import { calculateOpticalResponse } from '@/lib/solver-calculations';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
import type ReCAPTCHA from 'react-google-recaptcha';
import { verifyRecaptchaToken } from '@/app/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { saveSimulation as saveSimulationToStorage, getSimulationById } from '@/lib/localStorageUtils';

export default function SolverPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentFormValues, setCurrentFormValues] = useState<SolverFormValues | null>(null);
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const formRef = useRef<{ resetForm: (values: SolverFormValues) => void }>(null);


  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const simulationIdToLoad = searchParams.get('loadSimulationId');
    if (simulationIdToLoad && formRef.current?.resetForm) {
      const savedSim = getSimulationById(simulationIdToLoad);
      if (savedSim) {
        formRef.current.resetForm(savedSim.formValues);
        // Optionally set results if you want to show them immediately
        // setResults(savedSim.results); 
        // setCurrentFormValues(savedSim.formValues);
         toast({ title: "Simulation Loaded", description: `Loaded parameters for simulation: ${savedSim.name || savedSim.id}`});
      } else {
        toast({ title: "Load Failed", description: `Could not find simulation with ID: ${simulationIdToLoad}`, variant: "destructive"});
      }
      // Clean the URL parameter after loading
      router.replace('/solver', { scroll: false });
    }
  }, [searchParams, router, toast]);


  const handleFormSubmit = async (data: SolverFormValues) => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please login to perform calculations.", variant: "destructive" });
      router.push('/login');
      return;
    }

    setCurrentFormValues(data); // Store current form values for potential saving
    setIsLoading(true);
    setResults(null);

    if (siteKey) {
      const token = recaptchaRef.current?.getValue();
      if (!token) {
        toast({ title: "ReCAPTCHA Required", description: "Please complete the reCAPTCHA.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      try {
        const verification = await verifyRecaptchaToken(token);
        recaptchaRef.current?.reset();

        if (!verification.success) {
          toast({ title: "ReCAPTCHA Failed", description: verification.message, variant: "destructive" });
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error("Error verifying reCAPTCHA token:", error);
        toast({ title: "ReCAPTCHA Error", description: "Could not verify reCAPTCHA. Please try again.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
    } else {
      console.warn("ReCAPTCHA site key not configured. Skipping verification.");
    }

    startTransition(async () => {
      try {
        const calculationOutput = await calculateOpticalResponse(data);
        setResults({ data: calculationOutput.data, sweepParameter: calculationOutput.sweepParameter });
        toast({
          title: "Calculation Complete",
          description: "Optical response has been calculated.",
        });
      } catch (error) {
        console.error("Calculation error in SolverPage:", error);
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

  const handleSaveSimulation = (formVals: SolverFormValues, calcResults: CalculationResults) => {
    // Potentially prompt user for a name here, or use a default
    saveSimulationToStorage(formVals, calcResults);
  };


  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="space-y-8 container mx-auto px-4 py-8">
        <section aria-labelledby="solver-title-skeleton">
          <div className="text-center mb-8">
            <Skeleton className="h-10 w-3/4 mx-auto mb-4" />
            <Skeleton className="h-6 w-1/2 mx-auto" />
          </div>
        </section>
        <Separator />
        <Skeleton className="h-[600px] w-full rounded-lg" />
        <Separator />
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    );
  }
  
  if (!user) {
      return null; 
  }


  return (
    <div className="space-y-8 container mx-auto px-4 py-8">
      <section aria-labelledby="solver-title">
        <div className="text-center mb-8">
          <h1 id="solver-title" className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            Optical Stack Solver
          </h1>
          <p className="mt-4 text-lg leading-8 text-foreground/80">
            Define your optical stack parameters and calculate its response over wavelength or angle.
          </p>
        </div>
      </section>

      <Separator />

      <InputForm
        onSubmit={handleFormSubmit}
        isLoading={isLoading || isPending}
        recaptchaRef={recaptchaRef}
        recaptchaSiteKey={siteKey || ""}
        ref={formRef} // Pass the ref to InputForm
      />
      
      <Separator className="my-8" />

      <ResultsDisplay 
        results={results} 
        isLoading={isLoading || isPending}
        formValues={currentFormValues}
        onSaveSimulation={handleSaveSimulation}
      />
    </div>
  );
}
