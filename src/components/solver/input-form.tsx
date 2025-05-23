'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import type { SolverFormValues } from '@/types/solver';
import { SolverFormSchema, defaultSolverFormValues } from '@/types/solver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Layers, Ruler, Gem, GitCommitHorizontal, Waves, Calculator, AlertCircle } from 'lucide-react';
import React, { useEffect } from 'react';
import type { AiFeedback } from '@/types/solver';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface InputFormProps {
  onSubmit: (data: SolverFormValues) => void;
  onValidate: (data: SolverFormValues) => Promise<AiFeedback | null>;
  isLoading: boolean;
  initialAiFeedback?: AiFeedback;
}

export default function InputForm({ onSubmit, onValidate, isLoading, initialAiFeedback }: InputFormProps) {
  const form = useForm<SolverFormValues>({
    resolver: zodResolver(SolverFormSchema),
    defaultValues: defaultSolverFormValues,
    mode: 'onBlur',
  });

  const { control, watch, setValue, getValues, handleSubmit, formState: { errors } } = form;

  const numLayers = watch('numLayers');

  const { fields: thicknessFields, append: appendThickness, remove: removeThickness } = useFieldArray({
    control,
    name: 'thickness',
  });

  const { fields: refractiveIndexFields, append: appendRefractiveIndex, remove: removeRefractiveIndex } = useFieldArray({
    control,
    name: 'refractiveIndex',
  });

  const [aiFeedback, setAiFeedback] = React.useState<AiFeedback | null>(initialAiFeedback || null);

  useEffect(() => {
    if (isNaN(numLayers) || numLayers < 1 || numLayers > 10) return;

    const currentThickness = getValues("thickness") || [];
    const newThickness = Array(numLayers).fill(0).map((_, i) => currentThickness[i] === undefined ? 100 : currentThickness[i]);
    setValue("thickness", newThickness, { shouldValidate: true, shouldDirty: true });

    const currentRefractiveIndex = getValues("refractiveIndex") || [];
    const newRefractiveIndex = Array(numLayers).fill(0).map((_, i) => currentRefractiveIndex[i] === undefined ? 1.5 : currentRefractiveIndex[i]);
    setValue("refractiveIndex", newRefractiveIndex, { shouldValidate: true, shouldDirty: true });

  }, [numLayers, setValue, getValues]);
  
  const handleFormSubmit = async (data: SolverFormValues) => {
    setAiFeedback(null); // Clear previous AI feedback
    const validationFeedback = await onValidate(data);
    setAiFeedback(validationFeedback);

    if (validationFeedback && (validationFeedback.warnings.length > 0 || validationFeedback.suggestions.length > 0)) {
      // Optionally, you could prevent submission here or let the user proceed
      console.log("AI validation has warnings/suggestions.");
    }
    // Proceed with submission regardless of AI warnings for this demo
    onSubmit(data);
  };


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Layers size={24} /> Layer Parameters</CardTitle>
        <CardDescription>Define the multilayer stack properties.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={control}
                name="numLayers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1"><Layers size={16} />Number of Layers</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={control}
                name="angleOfIncidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1"><GitCommitHorizontal size={16} />Angle of Incidence (°)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="e.g., 0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={control}
                name="polarization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1"><Waves size={16} />Polarization</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select polarization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TE">TE (Transverse Electric)</SelectItem>
                        <SelectItem value="TM">TM (Transverse Magnetic)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {numLayers > 0 && !isNaN(numLayers) && numLayers <= 10 && (
              <>
                <Separator className="my-6" />
                <h3 className="text-lg font-medium mb-4">Layer Details</h3>
                {Array.from({ length: numLayers }).map((_, index) => (
                  <div key={index} className="p-4 border rounded-md space-y-4 mb-4 shadow-sm bg-muted/20">
                    <h4 className="font-semibold text-md text-primary">Layer {index + 1}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={control}
                      name={`thickness.${index}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><Ruler size={16} />Thickness (nm)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" placeholder={`Layer ${index + 1} thickness`} {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name={`refractiveIndex.${index}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><Gem size={16} />Refractive Index</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder={`Layer ${index + 1} index`} {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    </div>
                  </div>
                ))}
              </>
            )}
            
            {aiFeedback && (aiFeedback.warnings.length > 0 || aiFeedback.suggestions.length > 0) && (
              <Alert variant={aiFeedback.warnings.length > 0 ? "destructive" : "default"} className="mt-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{aiFeedback.warnings.length > 0 ? "AI Validation Warnings" : "AI Suggestions"}</AlertTitle>
                <AlertDescription>
                  {aiFeedback.warnings.map((warning, i) => <p key={`warn-${i}`}>{warning}</p>)}
                  {aiFeedback.suggestions.map((suggestion, i) => <p key={`sugg-${i}`}>{suggestion}</p>)}
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isLoading} className="w-full md:w-auto mt-6">
              <Calculator size={18} className="mr-2" />
              {isLoading ? 'Calculating...' : 'Calculate Optical Response'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
