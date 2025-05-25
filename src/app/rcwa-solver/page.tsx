
'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import type { RcwaSolverFormValues } from '@/types/rcwa-solver';
import { RcwaSolverFormSchema, defaultRcwaSolverFormValues } from '@/types/rcwa-solver';
import type { SolverFormValues as MainSolverFormValues } from '@/types/solver'; // For material library
import { defaultSolverFormValues as defaultMainSolverValues } from '@/types/solver'; // For material library

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Aperture, Binary, Blend, BookType, BotMessageSquare, Calculator, Waves, Sigma, Sparkles } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';

// Note: This page reuses the material library logic from the main solver form for simplicity.
// In a real application, you might share the material library through context or props.
// For this example, we'll just use the default "Air" material as options.
// A proper implementation would need access to the full material library.

export default function RcwaSolverPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<RcwaSolverFormValues>({
    resolver: zodResolver(RcwaSolverFormSchema),
    defaultValues: defaultRcwaSolverFormValues,
    mode: 'onBlur',
  });

  // For demo purposes, use the default material library from the main solver (just "Air" by default)
  // In a real app, this would be passed down or managed globally.
  const materialLibrary = defaultMainSolverValues.materialLibrary;

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  function onSubmit(data: RcwaSolverFormValues) {
    console.log('RCWA Solver Form Submitted (Placeholder):', data);
    toast({
      title: 'Calculation Submitted (Placeholder)',
      description: 'RCWA solver functionality is under development.',
    });
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-3/4 mx-auto mb-4" />
        <Skeleton className="h-6 w-1/2 mx-auto mb-8" />
        <Skeleton className="h-[600px] w-full rounded-lg" />
      </div>
    );
  }
  if (!user) return null;


  return (
    <div className="space-y-8">
      <section aria-labelledby="rcwa-solver-title">
        <div className="text-center mb-8">
          <h1 id="rcwa-solver-title" className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            RCWA Solver (Under Development)
          </h1>
          <p className="mt-4 text-lg leading-8 text-foreground/80">
            Define parameters for Rigorous Coupled-Wave Analysis.
          </p>
        </div>
      </section>

      <Separator />

      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl mb-2"><Sigma size={24} /> RCWA Input Parameters</CardTitle>
          <CardDescription>Specify grating geometry, incident light, and material properties.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <h3 className="text-base font-semibold flex items-center gap-2"><Aperture size={16}/>Global Parameters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 border rounded-md shadow-sm bg-card/50">
                <FormField control={form.control} name="wavelength" render={({ field }) => (
                  <FormItem><FormLabel className="text-sm">Wavelength (nm)</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g., 500" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                  <FormMessage /></FormItem> )} />
                <FormField control={form.control} name="incidentAngleTheta" render={({ field }) => (
                  <FormItem><FormLabel className="text-sm">Incident Angle Theta (°)</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g., 0" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                  <FormMessage /></FormItem> )} />
                <FormField control={form.control} name="incidentAnglePhi" render={({ field }) => (
                  <FormItem><FormLabel className="text-sm">Incident Angle Phi (°)</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g., 0" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                  <FormMessage /></FormItem> )} />
                 <FormField control={form.control} name="polarization" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-1 text-sm"><Waves size={14} />Polarization</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select polarization" /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="TE">TE (s-pol)</SelectItem><SelectItem value="TM">TM (p-pol)</SelectItem></SelectContent>
                      </Select><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="numHarmonics" render={({ field }) => (
                  <FormItem><FormLabel className="text-sm">Number of Harmonics</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g., 10" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)} /></FormControl>
                  <FormMessage /></FormItem> )} />
              </div>
              <Separator/>

              <h3 className="text-base font-semibold flex items-center gap-2"><Binary size={16}/>1D Binary Grating Definition</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 border rounded-md shadow-sm bg-card/50">
                <FormField control={form.control} name="gratingPeriod" render={({ field }) => (
                  <FormItem><FormLabel className="text-sm">Grating Period (nm)</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g., 300" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                  <FormMessage /></FormItem> )} />
                <FormField control={form.control} name="gratingThickness" render={({ field }) => (
                  <FormItem><FormLabel className="text-sm">Grating Thickness (nm)</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g., 100" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                  <FormMessage /></FormItem> )} />
                <FormField control={form.control} name="dutyCycle" render={({ field }) => (
                  <FormItem><FormLabel className="text-sm">Duty Cycle (0-1)</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="e.g., 0.5" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                  <FormMessage /></FormItem> )} />
                <FormField control={form.control} name="ridgeMaterialId" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-1 text-sm font-semibold"><Sparkles size={14}/>Ridge Material</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select ridge material" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {materialLibrary.map(material => (
                            <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="grooveMaterialId" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-1 text-sm font-semibold"><Blend size={14}/>Groove Material</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select groove material" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {materialLibrary.map(material => (
                            <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select><FormMessage /></FormItem> )} />
              </div>
              <Separator/>
              
              <h3 className="text-base font-semibold flex items-center gap-2"><BookType size={16}/>Surrounding Media</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-md shadow-sm bg-card/50">
                  <FormField control={form.control} name="incidentMediumMaterialId" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-1 text-sm font-semibold">Incident Medium (Top)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select incident material" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {materialLibrary.map(material => (
                            <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="substrateMediumMaterialId" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-1 text-sm font-semibold">Substrate Medium (Bottom)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select substrate material" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {materialLibrary.map(material => (
                            <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select><FormMessage /></FormItem> )} />
              </div>
              <Separator/>

              <div className="p-4 border rounded-md shadow-sm bg-card/50 text-center">
                <BotMessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <h4 className="text-lg font-semibold mb-2">Interactive Geometry Editor</h4>
                <p className="text-sm text-muted-foreground">
                  (Placeholder: A visual tool to define complex grating geometries will be added here in the future.)
                </p>
                 <div className="mt-4 h-48 bg-muted/50 rounded-md flex items-center justify-center">
                    <p className="text-muted-foreground italic">Grating Preview Area</p>
                </div>
              </div>
              <Separator/>

              <Button type="submit" disabled={true} className="w-full md:w-auto mt-6">
                <Calculator size={18} className="mr-2" />
                Calculate RCWA Response (Under Development)
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="mb-2">RCWA Results (Placeholder)</CardTitle>
          <CardDescription>Diffraction efficiencies for different orders will be displayed here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="min-h-[300px] flex items-center justify-center bg-muted/50 rounded-md">
            <p className="text-muted-foreground">RCWA simulation results will appear here after calculation.</p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
