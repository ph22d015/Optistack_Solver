
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import type { SolverFormValues } from '@/types/solver';
import { SolverFormSchema, defaultSolverFormValues } from '@/types/solver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Layers, Ruler, Gem, GitCommitHorizontal, Waves, Calculator, AlertCircle, ScanLine, Baseline, ArrowDownUp, BoxSelect } from 'lucide-react';
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

  const { control, watch, setValue, getValues, handleSubmit, formState: { errors, isSubmitting } } = form;

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
    const parsedNumLayers = parseInt(String(numLayers), 10);

    if (isNaN(parsedNumLayers) || parsedNumLayers < 0 || parsedNumLayers > 10) { 
      if (thicknessFields.length > 0) setValue("thickness", [], { shouldValidate: true, shouldDirty: true });
      if (refractiveIndexFields.length > 0) setValue("refractiveIndex", [], { shouldValidate: true, shouldDirty: true });
      return;
    }
  
    const currentThicknessLength = thicknessFields.length;
    if (parsedNumLayers > currentThicknessLength) {
      for (let i = currentThicknessLength; i < parsedNumLayers; i++) {
        appendThickness(getValues(`thickness.${i}`) ?? 100, { shouldFocus: false });
      }
    } else if (parsedNumLayers < currentThicknessLength) {
      for (let i = currentThicknessLength - 1; i >= parsedNumLayers; i--) {
        removeThickness(i);
      }
    }
  
    const currentRefractiveIndexLength = refractiveIndexFields.length;
    if (parsedNumLayers > currentRefractiveIndexLength) {
      for (let i = currentRefractiveIndexLength; i < parsedNumLayers; i++) {
        appendRefractiveIndex(
          getValues(`refractiveIndex.${i}`) ?? { n: 1.5, k: 0 }, 
          { shouldFocus: false }
        );
      }
    } else if (parsedNumLayers < currentRefractiveIndexLength) {
      for (let i = currentRefractiveIndexLength - 1; i >= parsedNumLayers; i--) {
        removeRefractiveIndex(i);
      }
    }
  }, [numLayers, appendThickness, removeThickness, appendRefractiveIndex, removeRefractiveIndex, thicknessFields.length, refractiveIndexFields.length, getValues, setValue]);
  

  const handleFormSubmit = async (data: SolverFormValues) => {
    setAiFeedback(null); 
    const validationFeedback = await onValidate(data);
    setAiFeedback(validationFeedback);

    if (validationFeedback && (validationFeedback.warnings.length > 0)) {
      console.log("AI validation has warnings.");
    }
    onSubmit(data);
  };


  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Layers size={24} /> Input Parameters</CardTitle>
        <CardDescription>Define the multilayer stack, surrounding media, optical, and wavelength properties.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            
            <h3 className="text-lg font-medium flex items-center gap-2"><ArrowDownUp size={20}/>Surrounding Media</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-md shadow-sm bg-card/50">
                <div>
                    <Label className="font-semibold text-md mb-2 block">Incident Medium (Top)</Label>
                    <div className="space-y-3">
                        <FormField
                            control={control}
                            name="incidentMediumRefractiveIndex.n"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-1"><Gem size={16} />Refractive Index (n)</FormLabel>
                                <FormControl>
                                <Input type="number" step="0.01" placeholder="e.g., 1.0" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name="incidentMediumRefractiveIndex.k"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-1"><Baseline size={16} />Extinction Coefficient (k)</FormLabel>
                                <FormControl>
                                <Input type="number" step="0.001" placeholder="e.g., 0.0" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                </div>
                 <div>
                    <Label className="font-semibold text-md mb-2 block">Substrate Medium (Bottom)</Label>
                     <div className="space-y-3">
                        <FormField
                            control={control}
                            name="substrateMediumRefractiveIndex.n"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-1"><Gem size={16} />Refractive Index (n)</FormLabel>
                                <FormControl>
                                <Input type="number" step="0.01" placeholder="e.g., 1.5" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name="substrateMediumRefractiveIndex.k"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-1"><Baseline size={16} />Extinction Coefficient (k)</FormLabel>
                                <FormControl>
                                <Input type="number" step="0.001" placeholder="e.g., 0.0" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                </div>
            </div>

            <Separator />
            <h3 className="text-lg font-medium flex items-center gap-2"><BoxSelect size={20}/>Stack & Optical Properties</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={control}
                name="numLayers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1"><Layers size={16} />Number of Layers</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 2" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
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
                      <Input type="number" step="0.1" placeholder="e.g., 0" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/>
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
            
            <Separator />
            <h3 className="text-lg font-medium flex items-center gap-2"><ScanLine size={20}/>Wavelength Range</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={control}
                    name="minWavelength"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Min Wavelength (nm)</FormLabel>
                        <FormControl>
                        <Input type="number" step="1" placeholder="e.g., 400" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="maxWavelength"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Max Wavelength (nm)</FormLabel>
                        <FormControl>
                        <Input type="number" step="1" placeholder="e.g., 700" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>


            {numLayers > 0 && !isNaN(numLayers) && numLayers <= 10 && (
              <>
                <Separator className="my-6" />
                <h3 className="text-lg font-medium mb-4">Layer Details (Sandwiched between Incident and Substrate Media)</h3>
                {Array.from({ length: numLayers }).map((_, index) => (
                  <div key={index} className="p-4 border rounded-md space-y-4 mb-4 shadow-sm bg-card">
                    <h4 className="font-semibold text-md text-primary">Layer {index + 1}</h4>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                        control={control}
                        name={`refractiveIndex.${index}.n`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="flex items-center gap-1"><Gem size={16} />Refractive Index (n)</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" placeholder="e.g., 1.5" {...field} 
                                onChange={e => field.onChange(parseFloat(e.target.value))}
                                />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={control}
                        name={`refractiveIndex.${index}.k`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="flex items-center gap-1"><Baseline size={16} />Extinction Coefficient (k)</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.001" placeholder="e.g., 0.0" {...field} 
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

            <Button type="submit" disabled={isLoading || isSubmitting} className="w-full md:w-auto mt-6">
              <Calculator size={18} className="mr-2" />
              {isLoading || isSubmitting ? 'Calculating...' : 'Calculate Optical Response'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
