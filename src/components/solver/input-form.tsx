
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import type { SolverFormValues, LayerMaterial, DispersiveDataPoint } from '@/types/solver';
import { SolverFormSchema, defaultSolverFormValues, defaultLayerMaterialConstant, defaultLayerMaterialDispersive } from '@/types/solver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Layers, Ruler, Gem, GitCommitHorizontal, Waves, Calculator, ScanLine, Baseline, ArrowDownUp, BoxSelect, Repeat, Sigma, PlusCircle, Trash2, Edit3, TableIcon } from 'lucide-react';
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

  const { control, watch, setValue, handleSubmit: formHandleSubmit, formState: { isSubmitting, errors } } = form;

  const numLayers = watch('numLayers');
  const sweepType = watch('sweepType');

  const { fields: thicknessFields, append: appendThickness, remove: removeThickness } = useFieldArray({
    control,
    name: 'thickness',
  });

  // useFieldArray for layerMaterials
  const { fields: layerMaterialFields, append: appendLayerMaterial, remove: removeLayerMaterial, update: updateLayerMaterial } = useFieldArray({
    control,
    name: 'layerMaterials',
  });


  useEffect(() => {
    const parsedNumLayers = parseInt(String(numLayers), 10);

    if (isNaN(parsedNumLayers) || parsedNumLayers < 0 || parsedNumLayers > 20) {
      if (thicknessFields.length > 0) setValue("thickness", [], { shouldValidate: true, shouldDirty: true });
      if (layerMaterialFields.length > 0) setValue("layerMaterials", [], { shouldValidate: true, shouldDirty: true });
      return;
    }

    // Sync thickness array
    const currentThicknessLength = thicknessFields.length;
    if (parsedNumLayers > currentThicknessLength) {
      for (let i = currentThicknessLength; i < parsedNumLayers; i++) {
        appendThickness(100, { shouldFocus: false }); // Default thickness 100nm
      }
    } else if (parsedNumLayers < currentThicknessLength) {
      for (let i = currentThicknessLength - 1; i >= parsedNumLayers; i--) {
        removeThickness(i);
      }
    }

    // Sync layerMaterials array
    const currentLayerMaterialLength = layerMaterialFields.length;
    if (parsedNumLayers > currentLayerMaterialLength) {
      for (let i = currentLayerMaterialLength; i < parsedNumLayers; i++) {
        appendLayerMaterial({ ...defaultLayerMaterialConstant }, { shouldFocus: false });
      }
    } else if (parsedNumLayers < currentLayerMaterialLength) {
      for (let i = currentLayerMaterialLength - 1; i >= parsedNumLayers; i--) {
        removeLayerMaterial(i);
      }
    }
  }, [numLayers, appendThickness, removeThickness, appendLayerMaterial, removeLayerMaterial, thicknessFields.length, layerMaterialFields.length, setValue]);


  const handleValidatedFormSubmit = (data: SolverFormValues) => {
    // Ensure dispersive data is sorted by wavelength before submission
    const processedData = {
      ...data,
      layerMaterials: data.layerMaterials.map(material => {
        if (material.type === 'dispersive') {
          return {
            ...material,
            data: [...material.data].sort((a, b) => a.wavelength - b.wavelength),
          };
        }
        return material;
      }),
    };
    onSubmit(processedData);
  };
  
  // Helper for dispersive data points within each layer
  // We need to manage field arrays for each layer's dispersive data
  // This is complex because useFieldArray is typically used at a fixed path.
  // For simplicity, we directly manipulate the form state for dispersive data points for now
  // or use a sub-component. Let's use a sub-component approach later if needed.
  // For now, a simple add/remove will modify the form's 'layerMaterials[index].data' array.

  const handleMaterialTypeChange = (layerIndex: number, newType: 'constant' | 'dispersive') => {
    const currentMaterial = watch(`layerMaterials.${layerIndex}`);
    if (newType === 'constant' && currentMaterial.type !== 'constant') {
      updateLayerMaterial(layerIndex, { ...defaultLayerMaterialConstant });
    } else if (newType === 'dispersive' && currentMaterial.type !== 'dispersive') {
      updateLayerMaterial(layerIndex, { ...defaultLayerMaterialDispersive });
    }
  };
  
  const addDispersivePoint = (layerIndex: number) => {
    const currentMaterial = watch(`layerMaterials.${layerIndex}`);
    if (currentMaterial.type === 'dispersive') {
      const newDataArray = [...currentMaterial.data, { wavelength: Math.max(...currentMaterial.data.map(p => p.wavelength), 0) + 50 , n: 1.5, k: 0.0 }];
      updateLayerMaterial(layerIndex, { ...currentMaterial, data: newDataArray });
    }
  };

  const removeDispersivePoint = (layerIndex: number, pointIndex: number) => {
    const currentMaterial = watch(`layerMaterials.${layerIndex}`);
    if (currentMaterial.type === 'dispersive' && currentMaterial.data.length > 2) { // Keep at least 2 points
      const newDataArray = currentMaterial.data.filter((_, idx) => idx !== pointIndex);
      updateLayerMaterial(layerIndex, { ...currentMaterial, data: newDataArray });
    }
  };


  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl mb-2"><Sigma size={24} /> Input Parameters</CardTitle>
        <CardDescription>Define the multilayer stack, surrounding media, optical, and sweep properties.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={formHandleSubmit(handleValidatedFormSubmit)} className="space-y-6">

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
                      <Input type="number" placeholder="e.g., 1" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" max="20" />
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
                {layerMaterialFields.map((layerField, index) => (
                  <div key={layerField.id} className="p-4 border rounded-md space-y-4 mb-4 shadow-sm bg-card">
                    <h4 className="font-semibold text-sm text-primary">Layer {index + 1}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                       <FormField
                          control={control}
                          name={`layerMaterials.${index}.type`}
                          render={({ field: typeField }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1"><Edit3 size={14}/>Material Type</FormLabel>
                              <Select 
                                onValueChange={(value: 'constant' | 'dispersive') => handleMaterialTypeChange(index, value)} 
                                defaultValue={typeField.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select material type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="constant">Constant n & k</SelectItem>
                                  <SelectItem value="dispersive">Dispersive (Table)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                    </div>
                    
                    {watch(`layerMaterials.${index}.type`) === 'constant' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <FormField
                          control={control}
                          name={`layerMaterials.${index}.n`}
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
                          name={`layerMaterials.${index}.k`}
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
                    )}

                    {watch(`layerMaterials.${index}.type`) === 'dispersive' && (
                      <div className="mt-4 space-y-3 p-3 border rounded-md bg-background/30">
                        <FormField
                          control={control}
                          name={`layerMaterials.${index}.materialName`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1"><Edit3 size={14} />Material Name (Optional)</FormLabel>
                              <FormControl>
                                <Input type="text" placeholder="e.g., SiO2" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-between items-center mb-2">
                            <FormLabel className="flex items-center gap-1"><TableIcon size={14} />Dispersion Data (Wavelength, n, k)</FormLabel>
                            <Button type="button" size="sm" variant="outline" onClick={() => addDispersivePoint(index)}>
                                <PlusCircle size={14} className="mr-1" /> Add Point
                            </Button>
                        </div>
                        {(watch(`layerMaterials.${index}.data`) || []).map((point, pointIndex) => (
                          <div key={`layer-${index}-point-${pointIndex}`} className="grid grid-cols-4 gap-2 items-center p-2 border-b last:border-b-0">
                            <FormField
                              control={control}
                              name={`layerMaterials.${index}.data.${pointIndex}.wavelength`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">λ (nm)</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.1" placeholder="Wavelength" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={control}
                              name={`layerMaterials.${index}.data.${pointIndex}.n`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">n</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.001" placeholder="n" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={control}
                              name={`layerMaterials.${index}.data.${pointIndex}.k`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">k</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.001" placeholder="k" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="mt-4 text-destructive hover:text-destructive/80" 
                              onClick={() => removeDispersivePoint(index, pointIndex)}
                              disabled={(watch(`layerMaterials.${index}.data`) || []).length <= 2}
                            >
                              <Trash2 size={16} />
                              <span className="sr-only">Remove Point</span>
                            </Button>
                          </div>
                        ))}
                        {/* Display Zod error for the whole data array if needed */}
                        {errors.layerMaterials?.[index]?.data?.message && (
                            <p className="text-sm font-medium text-destructive">{errors.layerMaterials?.[index]?.data?.message}</p>
                        )}
                      </div>
                    )}
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
    
