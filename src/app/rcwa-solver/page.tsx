
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import type { RcwaSolverFormValues, RcwaNamedMaterial, RcwaDispersiveDataPoint, RcwaLayerMaterialProperties } from '@/types/rcwa-solver';
import { RcwaSolverFormSchema, defaultRcwaSolverFormValues } from '@/types/rcwa-solver';
import { defaultLayerMaterialPropertiesConstant, defaultLayerMaterialPropertiesDispersive } from '@/types/solver'; // For new materials

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Aperture, Binary, Blend, BookType, BotMessageSquare, Calculator, Waves, Sigma, Sparkles, Library, PlusCircle, Trash2, Edit3, UploadCloud, Eye, FileJson, TableIcon, Gem, Baseline, Grid2x2, Square, Circle as LucideCircle, RectangleHorizontal } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import MaterialDataChart from '@/components/solver/material-data-chart'; // Re-use from TMM
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';

const DEFAULT_DISPERSIVE_POINTS_COUNT = 2; // For manual editing summary

export default function RcwaSolverPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [isMaterialPlotDialogOpen, setIsMaterialPlotDialogOpen] = useState(false);
  const [plottingMaterialData, setPlottingMaterialData] = useState<RcwaDispersiveDataPoint[] | null>(null);
  const [plottingMaterialName, setPlottingMaterialName] = useState<string | null>(null);

  const form = useForm<RcwaSolverFormValues>({
    resolver: zodResolver(RcwaSolverFormSchema),
    defaultValues: defaultRcwaSolverFormValues,
    mode: 'onBlur',
  });
  const { control, watch, setValue, handleSubmit, formState: { errors, isSubmitting } } = form;

  const dimensionality = watch('dimensionality');
  const featureShape2D = watch('featureShape2D');
  const materialLibrary = watch('materialLibrary');

  const { fields: libraryMaterialFields, append: appendLibraryMaterial, remove: removeLibraryMaterial, update: updateLibraryMaterial } = useFieldArray({
    control, name: 'materialLibrary',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  function onSubmit(data: RcwaSolverFormValues) {
    console.log('RCWA Solver Form Submitted (Placeholder):', data);
    toast({
      title: 'Calculation Submitted (Placeholder)',
      description: 'RCWA solver functionality is under development.',
      variant: 'default'
    });
  }

  // --- Material Library Helper Functions (adapted from TMM InputForm) ---
  const handleMaterialPropertyTypeChange = (libIndex: number, newType: 'constant' | 'dispersive') => {
    const currentMaterial = watch(`materialLibrary.${libIndex}`);
    const currentProperties = currentMaterial.properties;
    let newProperties: RcwaLayerMaterialProperties;
    if (newType === 'constant' && currentProperties.type !== 'constant') {
      newProperties = { ...defaultLayerMaterialPropertiesConstant, materialName: currentProperties.materialName || currentMaterial.name };
    } else if (newType === 'dispersive' && currentProperties.type !== 'dispersive') {
      newProperties = { ...defaultLayerMaterialPropertiesDispersive, materialName: currentProperties.materialName || currentMaterial.name };
    } else {
      return; // No change
    }
    setValue(`materialLibrary.${libIndex}.properties`, newProperties, { shouldValidate: true, shouldDirty: true });
  };

  const addDispersivePointToLibraryMaterial = (libIndex: number) => {
    const currentProperties = watch(`materialLibrary.${libIndex}.properties`);
    if (currentProperties.type === 'dispersive') {
      const currentData = currentProperties.data || [];
      const newDataArray = [...currentData, { wavelength: Math.max(...currentData.map(p => p.wavelength).filter(w => !isNaN(w)), 0) + 50, n: 1.5, k: 0.0 }];
      setValue(`materialLibrary.${libIndex}.properties.data`, newDataArray, { shouldValidate: true, shouldDirty: true });
    }
  };

  const removeDispersivePointFromLibraryMaterial = (libIndex: number, pointIndex: number) => {
    const currentProperties = watch(`materialLibrary.${libIndex}.properties`);
    if (currentProperties.type === 'dispersive' && currentProperties.data && currentProperties.data.length > DEFAULT_DISPERSIVE_POINTS_COUNT) {
      const newDataArray = currentProperties.data.filter((_, idx) => idx !== pointIndex);
      setValue(`materialLibrary.${libIndex}.properties.data`, newDataArray, { shouldValidate: true, shouldDirty: true });
    } else {
      toast({ title: "Minimum Points", description: `At least ${DEFAULT_DISPERSIVE_POINTS_COUNT} data points are required for manual editing.`, variant: "default" });
    }
  };
  
  const clearAndEditManually = (libraryMaterialIndex: number) => {
    setValue(`materialLibrary.${libraryMaterialIndex}.properties.data`, [...defaultLayerMaterialPropertiesDispersive.data], {shouldValidate: true, shouldDirty: true});
    toast({ title: "Data Cleared", description: "Dispersive data reset to default. You can now edit manually or upload a new file."});
  };

  const handleFileUploadForLibraryMaterial = async (event: React.ChangeEvent<HTMLInputElement>, libraryMaterialIndex: number) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) { toast({ title: "Error Reading File", variant: "destructive" }); return; }
      const points: RcwaDispersiveDataPoint[] = [];
      text.split(/\r\n|\n/).forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) return;
        const parts = trimmedLine.split(/[\s,;\t]+/);
        if (parts.length === 3) {
          const wavelength = parseFloat(parts[0]); const n = parseFloat(parts[1]); const k = parseFloat(parts[2]);
          if (!isNaN(wavelength) && !isNaN(n) && !isNaN(k)) points.push({ wavelength, n, k });
        }
      });
      if (points.length < 2) { toast({ title: "Insufficient Data", description: "At least two data points required.", variant: "destructive" }); return; }
      points.sort((a, b) => a.wavelength - b.wavelength);
      setValue(`materialLibrary.${libraryMaterialIndex}.properties.data`, points, { shouldValidate: true, shouldDirty: true });
      toast({ title: "File Processed", description: `${points.length} data points loaded.` });
    };
    reader.onerror = () => toast({ title: "Error Reading File", variant: "destructive" });
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handlePlotData = (libraryMaterialIndex: number) => {
    const material = watch(`materialLibrary.${libraryMaterialIndex}`);
    if (material && material.properties.type === 'dispersive' && material.properties.data) {
      setPlottingMaterialData(material.properties.data);
      setPlottingMaterialName(material.name);
      setIsMaterialPlotDialogOpen(true);
    } else {
      toast({ title: "No Data to Plot", variant: "default" });
    }
  };
  // --- End Material Library Helper Functions ---

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="space-y-8 container mx-auto px-4">
        <Skeleton className="h-10 w-3/4 mx-auto mb-4" /> <Skeleton className="h-6 w-1/2 mx-auto mb-8" />
        <Skeleton className="h-[600px] w-full rounded-lg" />
      </div>);
  }
  if (!user) return null;

  return (
    <div className="space-y-8 container mx-auto px-4">
      <section aria-labelledby="rcwa-solver-title">
        <div className="text-center mb-8">
          <h1 id="rcwa-solver-title" className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            RCWA Solver (Under Development)
          </h1>
          <p className="mt-4 text-lg leading-8 text-foreground/80">
            Define parameters for Rigorous Coupled-Wave Analysis for 1D or 2D periodic structures.
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

              {/* --- Material Library Definition --- */}
              <div className="space-y-4 p-4 border rounded-md shadow-sm bg-card/60">
                  <div className="flex justify-between items-center">
                      <h3 className="text-base font-semibold flex items-center gap-2"><Library size={20} /> Material Library</h3>
                      <Button type="button" size="sm" onClick={() => appendLibraryMaterial({ id: `mat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, name: `Material ${libraryMaterialFields.length + 1}`, properties: defaultLayerMaterialPropertiesConstant })}>
                          <PlusCircle size={16} className="mr-2" /> Add Material
                      </Button>
                  </div>
                  {libraryMaterialFields.length === 0 && <p className="text-sm text-muted-foreground">No materials defined.</p>}
                  <div className="space-y-6">
                  {libraryMaterialFields.map((libraryField, libIndex) => {
                      const currentMaterialProperties = watch(`materialLibrary.${libIndex}.properties`);
                      const dispersiveDataPoints = currentMaterialProperties.type === 'dispersive' ? currentMaterialProperties.data : [];
                      const showDispersiveTableInputs = currentMaterialProperties.type === 'dispersive' && (!dispersiveDataPoints || dispersiveDataPoints.length <= DEFAULT_DISPERSIVE_POINTS_COUNT);
                      return (
                      <Card key={libraryField.id} className="p-4 bg-background/30">
                          <div className="flex justify-between items-start mb-3">
                              <FormField control={control} name={`materialLibrary.${libIndex}.name`} render={({ field }) => (
                                  <FormItem className="flex-grow mr-2">
                                  <FormLabel className="text-sm font-medium">Material Name</FormLabel>
                                  <FormControl><Input placeholder="e.g., Silicon, Air" {...field} value={field.value || ''} /></FormControl>
                                  <FormMessage />
                                  </FormItem> )} />
                              <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 mt-6" onClick={() => removeLibraryMaterial(libIndex)} disabled={libraryMaterialFields.length <=1}>
                                  <Trash2 size={18} /> <span className="sr-only">Remove Material</span></Button>
                          </div>
                          <FormField control={control} name={`materialLibrary.${libIndex}.properties.type`} render={({ field: typeField }) => (
                              <FormItem className="mb-3">
                                  <FormLabel className="text-sm">Property Type</FormLabel>
                                  <Select onValueChange={(value: 'constant' | 'dispersive') => { handleMaterialPropertyTypeChange(libIndex, value); typeField.onChange(value); }} value={typeField.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Select property type" /></SelectTrigger></FormControl>
                                  <SelectContent><SelectItem value="constant">Constant n & k</SelectItem><SelectItem value="dispersive">Dispersive (Wavelength Dependent)</SelectItem></SelectContent>
                                  </Select><FormMessage /></FormItem> )} />
                          {currentMaterialProperties.type === 'constant' && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField control={control} name={`materialLibrary.${libIndex}.properties.n`} render={({ field }) => (
                                  <FormItem><FormLabel className="flex items-center gap-1 text-sm"><Gem size={14} />Refractive Index (n)</FormLabel>
                                  <FormControl><Input type="number" step="0.001" placeholder="e.g., 1.52" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                                  <FormMessage /></FormItem> )} />
                              <FormField control={control} name={`materialLibrary.${libIndex}.properties.k`} render={({ field }) => (
                                  <FormItem><FormLabel className="flex items-center gap-1 text-sm"><Baseline size={14} />Extinction Coefficient (k)</FormLabel>
                                  <FormControl><Input type="number" step="0.001" placeholder="e.g., 0.0" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                                  <FormMessage /></FormItem> )} />
                              </div> )}
                          {currentMaterialProperties.type === 'dispersive' && (
                              <div className="space-y-3 p-3 border rounded-md bg-background/50">
                                  <FormField control={control} name={`materialLibrary.${libIndex}.properties.materialName`} render={({ field }) => (
                                      <FormItem><FormLabel className="flex items-center gap-1 text-sm"><FileJson size={14} />Descriptive Name (Optional)</FormLabel>
                                      <FormControl><Input type="text" placeholder="e.g., SiO2 film, Gold - Palik" {...field} value={field.value ?? ''} /></FormControl>
                                      <FormMessage /></FormItem> )} />
                                  <div className="flex flex-wrap gap-2 items-center mb-2">
                                      <input type="file" accept=".csv,.txt,.dat" style={{ display: 'none' }} ref={el => fileInputRefs.current[libIndex] = el} onChange={(e) => handleFileUploadForLibraryMaterial(e, libIndex)} />
                                      <Button type="button" size="sm" variant="outline" onClick={() => fileInputRefs.current[libIndex]?.click()}><UploadCloud size={14} className="mr-1" /> Upload File</Button>
                                      {(!showDispersiveTableInputs && dispersiveDataPoints && dispersiveDataPoints.length > 0) && ( <>
                                              <Button type="button" size="sm" variant="outline" onClick={() => handlePlotData(libIndex)}><Eye size={14} className="mr-1" /> Plot Data</Button>
                                              <Button type="button" size="sm" variant="outline" onClick={() => clearAndEditManually(libIndex)}><Edit3 size={14} className="mr-1" /> Clear & Edit Manually</Button> </>)}
                                  </div>
                                  {showDispersiveTableInputs && ( <>
                                      <div className="flex justify-between items-center mb-2">
                                        <FormLabel className="flex items-center gap-1 text-sm"><TableIcon size={14} />Dispersion Data (Wavelength, n, k)</FormLabel>
                                        <Button type="button" size="sm" variant="outline" onClick={() => addDispersivePointToLibraryMaterial(libIndex)}><PlusCircle size={14} className="mr-1" /> Add Point</Button>
                                      </div>
                                      <Controller control={control} name={`materialLibrary.${libIndex}.properties.data`} render={({ field: { value = [] } }) => ( <>
                                              {(value as RcwaDispersiveDataPoint[]).map((_, pointIndex) => (
                                                  <div key={`libMat-${libIndex}-point-${pointIndex}`} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center p-2 border-b last:border-b-0">
                                                      <FormField control={control} name={`materialLibrary.${libIndex}.properties.data.${pointIndex}.wavelength`} render={({ field: dpField }) => ( <FormItem><FormLabel className="text-xs">λ (nm)</FormLabel><FormControl><Input type="number" step="0.1" placeholder="Wavelength" {...dpField} value={typeof dpField.value === 'number' && !isNaN(dpField.value) ? dpField.value : ''} onChange={e => dpField.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                                                      <FormField control={control} name={`materialLibrary.${libIndex}.properties.data.${pointIndex}.n`} render={({ field: dpField }) => ( <FormItem><FormLabel className="text-xs">n</FormLabel><FormControl><Input type="number" step="0.001" placeholder="n" {...dpField} value={typeof dpField.value === 'number' && !isNaN(dpField.value) ? dpField.value : ''} onChange={e => dpField.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                                                      <FormField control={control} name={`materialLibrary.${libIndex}.properties.data.${pointIndex}.k`} render={({ field: dpField }) => ( <FormItem><FormLabel className="text-xs">k</FormLabel><FormControl><Input type="number" step="0.001" placeholder="k" {...dpField} value={typeof dpField.value === 'number' && !isNaN(dpField.value) ? dpField.value : ''} onChange={e => dpField.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                                                      <Button type="button" variant="ghost" size="icon" className="mt-4 text-destructive hover:text-destructive/80" onClick={() => removeDispersivePointFromLibraryMaterial(libIndex, pointIndex)} disabled={(watch(`materialLibrary.${libIndex}.properties.data`) || []).length <= DEFAULT_DISPERSIVE_POINTS_COUNT}><Trash2 size={16} /><span className="sr-only">Remove Point</span></Button>
                                                  </div> ))}
                                              {errors.materialLibrary?.[libIndex]?.properties?.data?.message && <p className="text-sm font-medium text-destructive">{errors.materialLibrary?.[libIndex]?.properties?.data?.message as string}</p>}
                                              {errors.materialLibrary?.[libIndex]?.properties?.data?.root?.message && <p className="text-sm font-medium text-destructive">{errors.materialLibrary?.[libIndex]?.properties?.data?.root?.message as string}</p>} </>)} /> </>)}
                                  {(!showDispersiveTableInputs && dispersiveDataPoints && dispersiveDataPoints.length > 0) && ( <p className="text-sm text-muted-foreground pl-1">{dispersiveDataPoints.length} data points loaded.</p> )}
                              </div> )}
                      </Card> ); })}
                  </div>
                   {errors.materialLibrary?.message && <p className="text-sm font-medium text-destructive">{errors.materialLibrary.message as string}</p>}
                   {errors.materialLibrary?.root?.message && <p className="text-sm font-medium text-destructive">{errors.materialLibrary.root.message as string}</p>}
              </div>
              <Separator/>

              {/* --- Global Parameters --- */}
              <h3 className="text-base font-semibold flex items-center gap-2"><Aperture size={16}/>Global Parameters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 border rounded-md shadow-sm bg-card/50">
                <FormField control={control} name="wavelength" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Wavelength (nm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 500" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={control} name="incidentAngleTheta" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Incident Angle Theta (°)</FormLabel><FormControl><Input type="number" placeholder="e.g., 0" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={control} name="incidentAnglePhi" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Incident Angle Phi (°)</FormLabel><FormControl><Input type="number" placeholder="e.g., 0" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={control} name="polarization" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1 text-sm"><Waves size={14} />Polarization</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select polarization" /></SelectTrigger></FormControl><SelectContent><SelectItem value="TE">TE (s-pol)</SelectItem><SelectItem value="TM">TM (p-pol)</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField control={control} name="numHarmonics" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Number of Harmonics</FormLabel><FormControl><Input type="number" placeholder="e.g., 10" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <Separator/>

              {/* --- Grating Structure Definition --- */}
              <FormField control={control} name="dimensionality" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold flex items-center gap-2"><Grid2x2 size={16}/>Grating Dimensionality</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select dimensionality" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="1D">1D Periodic Structure</SelectItem>
                      <SelectItem value="2D">2D Periodic Structure</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              
              {dimensionality === '1D' && (
                <div className="space-y-6 p-4 border rounded-md shadow-sm bg-card/50">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Binary size={16}/>1D Binary Grating Parameters</h4>
                  <FormField control={control} name="gratingPeriod1D" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Grating Period (nm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 300" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={control} name="gratingThickness1D" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Grating Thickness (nm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={control} name="dutyCycle1D" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Duty Cycle (0-1)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 0.5" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={control} name="ridgeMaterialId1D" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1 text-sm font-semibold"><Sparkles size={14}/>Ridge Material</FormLabel><Select onValueChange={field.onChange} value={field.value ?? ''}><FormControl><SelectTrigger><SelectValue placeholder="Select ridge material" /></SelectTrigger></FormControl><SelectContent>{materialLibrary.map(material => (<SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                  <FormField control={control} name="grooveMaterialId1D" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1 text-sm font-semibold"><Blend size={14}/>Groove Material</FormLabel><Select onValueChange={field.onChange} value={field.value ?? ''}><FormControl><SelectTrigger><SelectValue placeholder="Select groove material" /></SelectTrigger></FormControl><SelectContent>{materialLibrary.map(material => (<SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                </div>
              )}

              {dimensionality === '2D' && (
                <div className="space-y-6 p-4 border rounded-md shadow-sm bg-card/50">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Grid2x2 size={16}/>2D Grating Parameters</h4>
                  <FormField control={control} name="periodX2D" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Period X (nm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 300" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={control} name="periodY2D" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Period Y (nm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 300" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={control} name="gratingThickness2D" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Grating Thickness (nm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={control} name="backgroundMaterialId2D" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1 text-sm font-semibold"><Blend size={14}/>Background Material (Unit Cell)</FormLabel><Select onValueChange={field.onChange} value={field.value ?? ''}><FormControl><SelectTrigger><SelectValue placeholder="Select background material" /></SelectTrigger></FormControl><SelectContent>{materialLibrary.map(material => (<SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                  
                  <FormField control={control} name="featureShape2D" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold flex items-center gap-1"><Sparkles size={14}/>Feature Shape</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select feature shape" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="circle"><LucideCircle className="inline h-4 w-4 mr-2"/>Circle</SelectItem>
                          <SelectItem value="square"><Square className="inline h-4 w-4 mr-2"/>Square</SelectItem>
                          <SelectItem value="rectangle"><RectangleHorizontal className="inline h-4 w-4 mr-2"/>Rectangle</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {featureShape2D && (
                     <FormField control={control} name="featureMaterialId2D" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1 text-sm font-semibold"><Sparkles size={14}/>Feature Material</FormLabel><Select onValueChange={field.onChange} value={field.value ?? ''}><FormControl><SelectTrigger><SelectValue placeholder="Select feature material" /></SelectTrigger></FormControl><SelectContent>{materialLibrary.map(material => (<SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                  )}

                  {featureShape2D === 'circle' && (
                    <FormField control={control} name="circleRadius2D" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Circle Radius (nm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 50" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                  )}
                  {featureShape2D === 'square' && (
                    <FormField control={control} name="squareSide2D" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Square Side Length (nm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                  )}
                  {featureShape2D === 'rectangle' && (<>
                    <FormField control={control} name="rectangleWidth2D" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Rectangle Width (nm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={control} name="rectangleHeight2D" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Rectangle Height (nm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 80" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                  </>)}
                </div>
              )}
              <Separator/>
              
              {/* --- Surrounding Media --- */}
              <h3 className="text-base font-semibold flex items-center gap-2"><BookType size={16}/>Surrounding Media</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-md shadow-sm bg-card/50">
                  <FormField control={control} name="incidentMediumMaterialId" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1 text-sm font-semibold">Incident Medium (Top)</FormLabel><Select onValueChange={field.onChange} value={field.value ?? ''}><FormControl><SelectTrigger><SelectValue placeholder="Select incident material" /></SelectTrigger></FormControl><SelectContent>{materialLibrary.map(material => (<SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                  <FormField control={control} name="substrateMediumMaterialId" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1 text-sm font-semibold">Substrate Medium (Bottom)</FormLabel><Select onValueChange={field.onChange} value={field.value ?? ''}><FormControl><SelectTrigger><SelectValue placeholder="Select substrate material" /></SelectTrigger></FormControl><SelectContent>{materialLibrary.map(material => (<SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
              </div>
              <Separator/>

              <div className="p-4 border rounded-md shadow-sm bg-card/50 text-center">
                <BotMessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <h4 className="text-lg font-semibold mb-2">Interactive Geometry Editor</h4>
                <p className="text-sm text-muted-foreground">(Placeholder: A visual tool to define complex grating geometries will be added here in the future.)</p>
                <div className="mt-4 h-48 bg-muted/50 rounded-md flex items-center justify-center">
                  <p className="text-muted-foreground italic">Grating Preview Area</p>
                </div>
              </div>
              <Separator/>

              <Button type="submit" disabled={true || isSubmitting} className="w-full md:w-auto mt-6">
                <Calculator size={18} className="mr-2" />
                {isSubmitting ? 'Submitting...' : 'Calculate RCWA Response (Under Development)'}
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

      {/* Dialog for plotting material data */}
      <Dialog open={isMaterialPlotDialogOpen} onOpenChange={setIsMaterialPlotDialogOpen}>
          <DialogContent className="sm:max-w-[70vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                  <DialogTitle>Material Dispersion Data: {plottingMaterialName || "Selected Material"}</DialogTitle>
                  <DialogDescription>Plot of Refractive Index (n) and Extinction Coefficient (k) vs. Wavelength.</DialogDescription>
              </DialogHeader>
              {plottingMaterialData && plottingMaterialName && (
                  <div className="py-4">
                      <MaterialDataChart data={plottingMaterialData} materialName={plottingMaterialName} />
                  </div> )}
              <DialogFooter>
                   <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}

    