
'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import InputForm from '@/components/solver/input-form';
import ResultsDisplay from '@/components/solver/results-display';
import type { SolverFormValues, CalculationResults } from '@/types/solver';
import { calculateOpticalResponse } from '@/lib/solver-calculations';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
import type ReCAPTCHA from 'react-google-recaptcha';
import { verifyRecaptchaToken } from '@/app/actions'; // Adjusted path
import { Skeleton } from '@/components/ui/skeleton';

export default function SolverPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleFormSubmit = async (data: SolverFormValues) => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please login to perform calculations.", variant: "destructive" });
      router.push('/login');
      return;
    }

    setIsLoading(true); // Set loading state immediately
    setResults(null); // Clear previous results

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
            data: [], // Provide empty data on error to clear chart
            sweepParameter: data.sweepType,
        });
      } finally {
        setIsLoading(false);
      }
    });
  };

  if (authLoading || (!user && !authLoading)) { // Show skeleton while loading or if no user and not finished loading
    return (
      <div className="space-y-8 container mx-auto px-4 py-8">
        <section aria-labelledby="solver-title-skeleton">
          <div className="text-center mb-8">
            <Skeleton className="h-10 w-3/4 mx-auto mb-4" />
            <Skeleton className="h-6 w-1/2 mx-auto" />
          </div>
        </section>
        <Separator />
        <Skeleton className="h-[600px] w-full rounded-lg" /> {/* Skeleton for InputForm */}
        <Separator />
        <Skeleton className="h-[400px] w-full rounded-lg" /> {/* Skeleton for ResultsDisplay */}
      </div>
    );
  }
  
  // If explicitly !user and authLoading is false (meaning auth check complete, no user)
  // useEffect will handle redirect, but can return null or minimal UI to prevent flash
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
      />
      
      <Separator className="my-8" />

      <ResultsDisplay results={results} isLoading={isLoading || isPending} />
    </div>
  );
}
