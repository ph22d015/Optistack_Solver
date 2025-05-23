
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Layers, Ruler, Gem, GitCommitHorizontal, Waves, Calculator, ScanLine, Baseline, ArrowDownUp, BoxSelect, Repeat, Sigma } from 'lucide-react';
import React, { useEffect, type RefObject } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

interface InputFormProps {
  onSubmit: (data: SolverFormValues) => void;
  isLoading: boolean;
  recaptchaRef: RefObject<ReCAPTCHA>;
  recaptchaSiteKey: string;
}

export default function InputForm({ onSubmit, isLoading, recaptchaRef, recaptchaSiteKey }: InputFormProps) {
  const form = useForm<SolverFormValues>({
    resolver: zodResolver(SolverFormSchema),
    defaultValues: defaultSolverFormValues,
    mode: 'onBlur',
  });

  const { control, watch, setValue, handleSubmit: formHandleSubmit, formState: { isSubmitting } } = form; // Renamed to avoid conflict

  const numLayers = watch('numLayers');
  const sweepType = watch('sweepType');

  const { fields: thicknessFields, append: appendThickness, remove: removeThickness } = useFieldArray({
    control,
    name: 'thickness',
  });

  const { fields: refractiveIndexFields, append: appendRefractiveIndex, remove: removeRefractiveIndex } = useFieldArray({
    control,
    name: 'refractiveIndex',
  });

  useEffect(() => {
    const parsedNumLayers = parseInt(String(numLayers), 10);

    if (isNaN(parsedNumLayers) || parsedNumLayers < 0 || parsedNumLayers > 20) { 
      if (thicknessFields.length > 0) setValue("thickness", [], { shouldValidate: true, shouldDirty: true });
      if (refractiveIndexFields.length > 0) setValue("refractiveIndex", [], { shouldValidate: true, shouldDirty: true });
      return;
    }

    const currentThicknessLength = thicknessFields.length;
    if (parsedNumLayers > currentThicknessLength) {
      for (let i = currentThicknessLength; i < parsedNumLayers; i++) {
        appendThickness(100, { shouldFocus: false }); 
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
          { n: 1.0, k: 0.0 }, 
          { shouldFocus: false }
        );
      }
    } else if (parsedNumLayers < currentRefractiveIndexLength) {
      for (let i = currentRefractiveIndexLength - 1; i >= parsedNumLayers; i--) {
        removeRefractiveIndex(i);
      }
    }
  }, [numLayers, appendThickness, removeThickness, appendRefractiveIndex, removeRefractiveIndex, thicknessFields.length, refractiveIndexFields.length, setValue]);

  // This is the function that react-hook-form's handleSubmit will call with validated data.
  // The actual submission logic (including reCAPTCHA) is in the `onSubmit` prop from `HomePage`.
  const handleValidatedFormSubmit = (data: SolverFormValues) => {
    onSubmit(data); // Call the orchestrating function from HomePage
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl mb-2"><Sigma size={24} /> Input Parameters</CardTitle>
        <CardDescription>Define the multilayer stack, surrounding media, optical, and sweep properties.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={formHandleSubmit(handleValidatedFormSubmit)} className="space-y-6"> {/* Use react-hook-form's handleSubmit */}
            
            <FormField
              control={control}
              name="sweepType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Repeat size={16} />Calculation Sweep Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sweep type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="wavelength">Sweep Wavelength (fixed angle)</SelectItem>
                      <SelectItem value="angle">Sweep Angle (fixed wavelength)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose whether to calculate response over a range of wavelengths or a range of angles.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Separator/>

            <h3 className="text-base font-semibold flex items-center gap-2"><ArrowDownUp size={16}/>Surrounding Media</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-md shadow-sm bg-card/50">
                <div>
                    <Label className="font-semibold text-sm mb-2 block">Incident Medium (Top)</Label>
                    <div className="space-y-3">
                        <FormField
                            control={control}
                            name="incidentMediumRefractiveIndex.n"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-1"><Gem size={14} />Refractive Index (n)</FormLabel>
                                <FormControl>
                                <Input type="number" step="0.01" placeholder="e.g., 1.0" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))}/>
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
                                <FormLabel className="flex items-center gap-1"><Baseline size={14} />Extinction Coefficient (k)</FormLabel>
                                <FormControl>
                                <Input type="number" step="0.001" placeholder="e.g., 0.0" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                </div>
                 <div>
                    <Label className="font-semibold text-sm mb-2 block">Substrate Medium (Bottom)</Label>
                     <div className="space-y-3">
                        <FormField
                            control={control}
                            name="substrateMediumRefractiveIndex.n"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-1"><Gem size={14} />Refractive Index (n)</FormLabel>
                                <FormControl>
                                <Input type="number" step="0.01" placeholder="e.g., 1.0" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))}/>
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
                                <FormLabel className="flex items-center gap-1"><Baseline size={14} />Extinction Coefficient (k)</FormLabel>
                                <FormControl>
                                <Input type="number" step="0.001" placeholder="e.g., 0.0" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                </div>
            </div>

            <Separator />
            <h3 className="text-base font-semibold flex items-center gap-2"><BoxSelect size={16}/>Stack & Common Optical Properties</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> 
              <FormField
                control={control}
                name="numLayers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1"><Layers size={14} />Number of Internal Layers</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 1" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
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
                    <FormLabel className="flex items-center gap-1"><Waves size={14} />Polarization</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select polarization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TE">TE (Transverse Electric / s-pol)</SelectItem>
                        <SelectItem value="TM">TM (Transverse Magnetic / p-pol)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <Separator />

            {sweepType === 'wavelength' && (
              <>
                <h3 className="text-base font-semibold flex items-center gap-2"><ScanLine size={16}/>Wavelength Sweep Parameters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                        control={control}
                        name="minWavelength"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Min Wavelength (nm)</FormLabel>
                            <FormControl>
                            <Input type="number" step="1" placeholder="e.g., 400" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))}/>
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
                            <Input type="number" step="1" placeholder="e.g., 700" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))}/>
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
                            <FormLabel className="flex items-center gap-1"><GitCommitHorizontal size={14} />Fixed Angle of Incidence (°)</FormLabel>
                            <FormControl>
                            <Input type="number" step="0.1" placeholder="e.g., 0" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
              </>
            )}

            {sweepType === 'angle' && (
              <>
                <h3 className="text-base font-semibold flex items-center gap-2"><GitCommitHorizontal size={16}/>Angle Sweep Parameters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                        control={control}
                        name="wavelength"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-1"><ScanLine size={14} />Fixed Wavelength (nm)</FormLabel>
                            <FormControl>
                            <Input type="number" step="1" placeholder="e.g., 500" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name="minAngle"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Min Angle of Incidence (°)</FormLabel>
                            <FormControl>
                            <Input type="number" step="0.1" placeholder="e.g., 0" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name="maxAngle"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Max Angle of Incidence (°)</FormLabel>
                            <FormControl>
                            <Input type="number" step="0.1" placeholder="e.g., 89.9" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
              </>
            )}


            {numLayers > 0 && !isNaN(numLayers) && numLayers <= 20 && ( 
              <>
                <Separator className="my-6" />
                <h3 className="text-base font-semibold mb-4">Layer Details (Sandwiched between Incident and Substrate Media)</h3>
                {Array.from({ length: numLayers }).map((_, index) => (
                  <div key={index} className="p-4 border rounded-md space-y-4 mb-4 shadow-sm bg-card">
                    <h4 className="font-semibold text-sm text-primary">Layer {index + 1}</h4>
                    <FormField
                      control={control}
                      name={`thickness.${index}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><Ruler size={14} />Thickness (nm)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" placeholder={`Layer ${index + 1} thickness`} {...field}
                            value={field.value ?? ''}
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
                            <FormLabel className="flex items-center gap-1"><Gem size={14} />Refractive Index (n)</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" placeholder="e.g., 1.0" {...field}
                                value={field.value ?? ''}
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
                            <FormLabel className="flex items-center gap-1"><Baseline size={14} />Extinction Coefficient (k)</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.001" placeholder="e.g., 0.0" {...field}
                                value={field.value ?? ''}
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
            
            {recaptchaSiteKey && (
              <div className="my-6 flex justify-center md:justify-start">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={recaptchaSiteKey}
                />
              </div>
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
