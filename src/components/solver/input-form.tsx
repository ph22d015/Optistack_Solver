
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import type { SolverFormValues, NamedMaterial, DispersiveDataPoint, LayerMaterialProperties } from '@/types/solver';
import { SolverFormSchema, defaultSolverFormValues, defaultLayerMaterialPropertiesConstant, defaultLayerMaterialPropertiesDispersive } from '@/types/solver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Layers, Ruler, Gem, GitCommitHorizontal, Waves, Calculator, ScanLine, Baseline, ArrowDownUp, BoxSelect, Repeat, Sigma, PlusCircle, Trash2, Edit3, TableIcon, UploadCloud, Library, FileJson, BookType, Eye, Sparkles } from 'lucide-react';
import React, { useEffect, type RefObject, useRef, useState } from 'react';
import type ReCAPTCHA from 'react-google-recaptcha';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import MaterialDataChart from './material-data-chart';
import StackVisualizer from './stack-visualizer';


interface InputFormProps {
  onSubmit: (data: SolverFormValues) => void;
  isLoading: boolean;
  recaptchaRef: RefObject<ReCAPTCHA>;
  recaptchaSiteKey: string;
}

const DEFAULT_DISPERSIVE_POINTS_COUNT = 2; 

export default function InputForm({ onSubmit, isLoading, recaptchaRef, recaptchaSiteKey }: InputFormProps) {
  const form = useForm<SolverFormValues>({
    resolver: zodResolver(SolverFormSchema),
    defaultValues: defaultSolverFormValues,
    mode: 'onBlur', 
  });
  const { toast } = useToast();
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [isMaterialPlotDialogOpen, setIsMaterialPlotDialogOpen] = useState(false);
  const [plottingMaterialData, setPlottingMaterialData] = useState<DispersiveDataPoint[] | null>(null);
  const [plottingMaterialName, setPlottingMaterialName] = useState<string | null>(null);


  const { control, watch, setValue, handleSubmit: formHandleSubmit, formState: { isSubmitting, errors } } = form;

  const numLayers = watch('numLayers');
  const sweepType = watch('sweepType');
  const materialLibrary = watch('materialLibrary');
  const incidentMediumMaterialId = watch('incidentMediumMaterialId');
  const substrateMediumMaterialId = watch('substrateMediumMaterialId');
  const layerMaterials = watch('layerMaterials');
  const thicknesses = watch('thickness');


  const { fields: thicknessFields, append: appendThickness, remove: removeThickness } = useFieldArray({
    control,
    name: 'thickness',
  });

  const { fields: layerMaterialSelectionFields, append: appendLayerMaterialSelection, remove: removeLayerMaterialSelection } = useFieldArray({
    control,
    name: 'layerMaterials',
  });

  const { fields: libraryMaterialFields, append: appendLibraryMaterial, remove: removeLibraryMaterial } = useFieldArray({
    control,
    name: 'materialLibrary',
  });

  useEffect(() => {
    const parsedNumLayers = parseInt(String(numLayers), 10);

    if (isNaN(parsedNumLayers) || parsedNumLayers < 0 || parsedNumLayers > 20) {
      if (thicknessFields.length > 0) setValue("thickness", [], { shouldValidate: true, shouldDirty: true });
      if (layerMaterialSelectionFields.length > 0) setValue("layerMaterials", [], { shouldValidate: true, shouldDirty: true });
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

    const currentLayerMaterialSelectionLength = layerMaterialSelectionFields.length;
    if (parsedNumLayers > currentLayerMaterialSelectionLength) {
      for (let i = currentLayerMaterialSelectionLength; i < parsedNumLayers; i++) {
        const defaultMatIdForNewLayer = materialLibrary && materialLibrary.length > 0 ? materialLibrary[0].id : '';
        appendLayerMaterialSelection({ materialId: defaultMatIdForNewLayer }, { shouldFocus: false });
      }
    } else if (parsedNumLayers < currentLayerMaterialSelectionLength) {
      for (let i = currentLayerMaterialSelectionLength - 1; i >= parsedNumLayers; i--) {
        removeLayerMaterialSelection(i);
      }
    }
  }, [numLayers, appendThickness, removeThickness, appendLayerMaterialSelection, removeLayerMaterialSelection, thicknessFields.length, layerMaterialSelectionFields.length, setValue, materialLibrary]);


  const handleValidatedFormSubmit = (data: SolverFormValues) => {
    console.log("Form validation successful, submitting data:", data);
    const processedData = {
      ...data,
      materialLibrary: data.materialLibrary.map(material => {
        if (material.properties.type === 'dispersive' && material.properties.data) {
          return {
            ...material,
            properties: {
              ...material.properties,
              // Ensure data is sorted before submission
              data: [...material.properties.data].sort((a, b) => a.wavelength - b.wavelength),
            }
          };
        }
        return material;
      }),
    };
    onSubmit(processedData);
  };
  
  const handleMaterialPropertyTypeChange = (libraryMaterialIndex: number, newType: 'constant' | 'dispersive') => {
    const currentMaterialName = watch(`materialLibrary.${libraryMaterialIndex}.name`);
    const currentProperties = watch(`materialLibrary.${libraryMaterialIndex}.properties`);

    if (newType === 'constant' && currentProperties.type !== 'constant') {
      setValue(`materialLibrary.${libraryMaterialIndex}.properties`, { ...defaultLayerMaterialPropertiesConstant, materialName: currentProperties.materialName || currentMaterialName });
    } else if (newType === 'dispersive' && currentProperties.type !== 'dispersive') {
      setValue(`materialLibrary.${libraryMaterialIndex}.properties`, { ...defaultLayerMaterialPropertiesDispersive, materialName: currentProperties.materialName || currentMaterialName });
    }
  };

  const addDispersivePointToLibraryMaterial = (libraryMaterialIndex: number) => {
    const currentProperties = watch(`materialLibrary.${libraryMaterialIndex}.properties`);
    if (currentProperties.type === 'dispersive') {
      const currentData = currentProperties.data || [];
      const newDataArray = [...currentData, { wavelength: Math.max(...currentData.map(p => p.wavelength).filter(w => !isNaN(w)), 0) + 50 , n: 1.5, k: 0.0 }];
      setValue(`materialLibrary.${libraryMaterialIndex}.properties.data`, newDataArray, {shouldValidate: true, shouldDirty: true});
    }
  };

  const removeDispersivePointFromLibraryMaterial = (libraryMaterialIndex: number, pointIndex: number) => {
    const currentProperties = watch(`materialLibrary.${libraryMaterialIndex}.properties`);
    if (currentProperties.type === 'dispersive' && currentProperties.data && currentProperties.data.length > DEFAULT_DISPERSIVE_POINTS_COUNT) {
      const newDataArray = currentProperties.data.filter((_, idx) => idx !== pointIndex);
      setValue(`materialLibrary.${libraryMaterialIndex}.properties.data`, newDataArray, {shouldValidate: true, shouldDirty: true});
    } else {
      toast({ title: "Minimum Points", description: `At least ${DEFAULT_DISPERSIVE_POINTS_COUNT} data points are required for manual editing.`, variant: "default"});
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
      if (!text) {
        toast({ title: "Error Reading File", description: "Could not read file content.", variant: "destructive" });
        return;
      }
      const points: DispersiveDataPoint[] = [];
      const lines = text.split(/\r\n|\n/);
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) return; 
        const parts = trimmedLine.split(/[\s,;\t]+/); 
        if (parts.length === 3) {
          const wavelength = parseFloat(parts[0]);
          const n = parseFloat(parts[1]);
          const k = parseFloat(parts[2]);
          if (!isNaN(wavelength) && !isNaN(n) && !isNaN(k)) {
            points.push({ wavelength, n, k });
          }
        }
      });

      if (points.length < 2) {
        toast({ title: "Insufficient Data", description: "At least two data points are required. File parsing might have failed or data is insufficient.", variant: "destructive"});
        return;
      }
      points.sort((a, b) => a.wavelength - b.wavelength);

      setValue(`materialLibrary.${libraryMaterialIndex}.properties.data`, points, {shouldValidate: true, shouldDirty: true});
      toast({ title: "File Processed", description: `${points.length} data points loaded for material "${watch(`materialLibrary.${libraryMaterialIndex}.name`)}".` });
    };
    reader.onerror = () => toast({ title: "Error Reading File", description: "An error occurred while reading the file.", variant: "destructive" });
    reader.readAsText(file);
    if(event.target) event.target.value = ''; 
  };
  
  const handlePlotData = (libraryMaterialIndex: number) => {
    const material = watch(`materialLibrary.${libraryMaterialIndex}`);
    if (material && material.properties.type === 'dispersive' && material.properties.data) {
      setPlottingMaterialData(material.properties.data);
      setPlottingMaterialName(material.name);
      setIsMaterialPlotDialogOpen(true);
    } else {
      toast({ title: "No Data to Plot", description: "Dispersive data is not available for this material or material type is not dispersive.", variant: "default"});
    }
  };

  // Prepare data for StackVisualizer
  const incidentMat = materialLibrary.find(m => m.id === incidentMediumMaterialId);
  const substrateMat = materialLibrary.find(m => m.id === substrateMediumMaterialId);
  const internalLayersForVisualizer = Array.from({ length: numLayers }, (_, i) => {
    const layerMatId = layerMaterials[i]?.materialId;
    const material = materialLibrary.find(m => m.id === layerMatId);
    return {
      materialName: material?.name,
      thickness: thicknesses[i] ?? 0,
    };
  });


  return (
    <>
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl mb-2"><Sigma size={24} /> Input Parameters</CardTitle>
        <CardDescription>Define the multilayer stack, surrounding media, optical, and sweep properties.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleValidatedFormSubmit)} className="space-y-8">

            {/* --- Material Library Section --- */}
            <div className="space-y-4 p-4 border rounded-md shadow-sm bg-card/60">
                <div className="flex justify-between items-center">
                    <h3 className="text-base font-semibold flex items-center gap-2"><Library size={20} /> Material Library</h3>
                    <Button type="button" size="sm" onClick={() => appendLibraryMaterial({ ...defaultSolverFormValues.materialLibrary[0], id: `mat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, name: `Material ${libraryMaterialFields.length + 1}` })}>
                        <PlusCircle size={16} className="mr-2" /> Add Material
                    </Button>
                </div>
                {libraryMaterialFields.length === 0 && <p className="text-sm text-muted-foreground">No materials defined. Add materials to use in layers and for surrounding media.</p>}
                <div className="space-y-6">
                {libraryMaterialFields.map((libraryField, libIndex) => {
                    const currentMaterialProperties = watch(`materialLibrary.${libIndex}.properties`);
                    const dispersiveDataPoints = currentMaterialProperties.type === 'dispersive' ? currentMaterialProperties.data : [];
                    const showDispersiveTableInputs = currentMaterialProperties.type === 'dispersive' && (!dispersiveDataPoints || dispersiveDataPoints.length <= DEFAULT_DISPERSIVE_POINTS_COUNT);

                    return (
                    <Card key={libraryField.id} className="p-4 bg-background/30">
                        <div className="flex justify-between items-start mb-3">
                            <FormField
                            control={control}
                            name={`materialLibrary.${libIndex}.name`}
                            render={({ field }) => (
                                <FormItem className="flex-grow mr-2">
                                <FormLabel className="text-sm font-medium">Material Name</FormLabel>
                                <FormControl><Input placeholder="e.g., Silicon, Air, Custom Glass" {...field} value={typeof field.value === 'string' ? field.value : ''} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 mt-6" onClick={() => removeLibraryMaterial(libIndex)} disabled={libraryMaterialFields.length <=1}>
                                <Trash2 size={18} /> <span className="sr-only">Remove Material</span>
                            </Button>
                        </div>

                        <FormField
                            control={control}
                            name={`materialLibrary.${libIndex}.properties.type`}
                            render={({ field: typeField }) => (
                            <FormItem className="mb-3">
                                <FormLabel className="text-sm">Material Property Type</FormLabel>
                                <Select
                                onValueChange={(value: 'constant' | 'dispersive') => {
                                    handleMaterialPropertyTypeChange(libIndex, value);
                                    typeField.onChange(value);
                                }}
                                value={typeField.value}
                                >
                                <FormControl><SelectTrigger><SelectValue placeholder="Select property type" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="constant">Constant n & k</SelectItem>
                                    <SelectItem value="dispersive">Dispersive (Wavelength Dependent)</SelectItem>
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

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
                            </div>
                        )}

                        {currentMaterialProperties.type === 'dispersive' && (
                            <div className="space-y-3 p-3 border rounded-md bg-background/50">
                                <FormField control={control} name={`materialLibrary.${libIndex}.properties.materialName`} render={({ field }) => (
                                    <FormItem><FormLabel className="flex items-center gap-1 text-sm"><FileJson size={14} />Descriptive Name (Optional)</FormLabel>
                                    <FormControl><Input type="text" placeholder="e.g., SiO2 film, Gold - Palik" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage /></FormItem> )} />

                                <div className="flex flex-wrap gap-2 items-center mb-2">
                                    <input type="file" accept=".csv,.txt,.dat" style={{ display: 'none' }} ref={el => fileInputRefs.current[libIndex] = el} onChange={(e) => handleFileUploadForLibraryMaterial(e, libIndex)} />
                                    <Button type="button" size="sm" variant="outline" onClick={() => fileInputRefs.current[libIndex]?.click()}><UploadCloud size={14} className="mr-1" /> Upload File</Button>
                                    
                                    {!showDispersiveTableInputs && dispersiveDataPoints && dispersiveDataPoints.length > 0 && (
                                        <>
                                            <Button type="button" size="sm" variant="outline" onClick={() => handlePlotData(libIndex)}>
                                                <Eye size={14} className="mr-1" /> Plot Data
                                            </Button>
                                            <Button type="button" size="sm" variant="outline" onClick={() => clearAndEditManually(libIndex)}>
                                                <Edit3 size={14} className="mr-1" /> Clear & Edit Manually
                                            </Button>
                                        </>
                                    )}
                                </div>
                                
                                {showDispersiveTableInputs && (
                                    <>
                                    <div className="flex justify-between items-center mb-2">
                                      <FormLabel className="flex items-center gap-1 text-sm"><TableIcon size={14} />Dispersion Data (Wavelength, n, k)</FormLabel>
                                      <Button type="button" size="sm" variant="outline" onClick={() => addDispersivePointToLibraryMaterial(libIndex)}><PlusCircle size={14} className="mr-1" /> Add Point</Button>
                                    </div>
                                    <Controller
                                        control={control}
                                        name={`materialLibrary.${libIndex}.properties.data`}
                                        render={({ field: { value = [], onChange } }) => (
                                            <>
                                            {(value as DispersiveDataPoint[]).map((point, pointIndex) => (
                                                <div key={`libMat-${libIndex}-point-${pointIndex}`} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center p-2 border-b last:border-b-0">
                                                    <FormField control={control} name={`materialLibrary.${libIndex}.properties.data.${pointIndex}.wavelength`} render={({ field: dpField }) => (
                                                        <FormItem><FormLabel className="text-xs">λ (nm)</FormLabel><FormControl><Input type="number" step="0.1" placeholder="Wavelength" {...dpField} value={typeof dpField.value === 'number' && !isNaN(dpField.value) ? dpField.value : ''} onChange={e => dpField.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={control} name={`materialLibrary.${libIndex}.properties.data.${pointIndex}.n`} render={({ field: dpField }) => (
                                                        <FormItem><FormLabel className="text-xs">n</FormLabel><FormControl><Input type="number" step="0.001" placeholder="n" {...dpField} value={typeof dpField.value === 'number' && !isNaN(dpField.value) ? dpField.value : ''} onChange={e => dpField.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={control} name={`materialLibrary.${libIndex}.properties.data.${pointIndex}.k`} render={({ field: dpField }) => (
                                                        <FormItem><FormLabel className="text-xs">k</FormLabel><FormControl><Input type="number" step="0.001" placeholder="k" {...dpField} value={typeof dpField.value === 'number' && !isNaN(dpField.value) ? dpField.value : ''} onChange={e => dpField.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                                                    <Button type="button" variant="ghost" size="icon" className="mt-4 text-destructive hover:text-destructive/80" onClick={() => removeDispersivePointFromLibraryMaterial(libIndex, pointIndex)} disabled={(watch(`materialLibrary.${libIndex}.properties.data`) || []).length <= DEFAULT_DISPERSIVE_POINTS_COUNT}><Trash2 size={16} /><span className="sr-only">Remove Point</span></Button>
                                                </div>
                                            ))}
                                            {errors.materialLibrary?.[libIndex]?.properties?.data?.message && <p className="text-sm font-medium text-destructive">{errors.materialLibrary?.[libIndex]?.properties?.data?.message as string}</p>}
                                            {errors.materialLibrary?.[libIndex]?.properties?.data?.root?.message && <p className="text-sm font-medium text-destructive">{errors.materialLibrary?.[libIndex]?.properties?.data?.root?.message as string}</p>}
                                            </>
                                        )}
                                    />
                                    </>
                                )}
                                {!showDispersiveTableInputs && dispersiveDataPoints && dispersiveDataPoints.length > 0 && (
                                    <p className="text-sm text-muted-foreground pl-1">{dispersiveDataPoints.length} data points loaded.</p>
                                )}
                            </div>
                        )}
                    </Card>
                    );
                })}
                </div>
                 {errors.materialLibrary?.message && <p className="text-sm font-medium text-destructive">{errors.materialLibrary.message as string}</p>}
                 {errors.materialLibrary?.root?.message && <p className="text-sm font-medium text-destructive">{errors.materialLibrary.root.message as string}</p>}
            </div>
            <Separator/>

            {/* --- Sweep Type Section --- */}
            <FormField control={control} name="sweepType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold flex items-center gap-1"><Repeat size={16} />Calculation Sweep Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select sweep type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="wavelength">Sweep Wavelength (fixed angle)</SelectItem>
                      <SelectItem value="angle">Sweep Angle (fixed wavelength)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose calculation over wavelengths or angles.</FormDescription>
                  <FormMessage />
                </FormItem> )} />
            <Separator/>

            {/* --- Surrounding Media Section --- */}
            <h3 className="text-base font-semibold flex items-center gap-2"><ArrowDownUp size={16}/>Surrounding Media</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-md shadow-sm bg-card/50">
                <FormField control={control} name="incidentMediumMaterialId" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-1 text-sm font-semibold"><BookType size={14}/>Incident Medium (Top)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select incident material" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {materialLibrary.length === 0 && <SelectItem value="" disabled>No materials in library</SelectItem>}
                        {materialLibrary.map(material => (
                          <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select><FormMessage /></FormItem> )} />
                <FormField control={control} name="substrateMediumMaterialId" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-1 text-sm font-semibold"><BookType size={14}/>Substrate Medium (Bottom)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select substrate material" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {materialLibrary.length === 0 && <SelectItem value="" disabled>No materials in library</SelectItem>}
                        {materialLibrary.map(material => (
                          <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select><FormMessage /></FormItem> )} />
            </div>
            <Separator />

            {/* --- Stack & Common Optical Properties --- */}
            <h3 className="text-base font-semibold flex items-center gap-2"><BoxSelect size={16}/>Stack & Common Optical Properties</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={control} name="numLayers" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-1 text-sm"><Layers size={14} />Number of Internal Layers</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g., 0" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="0" max="20" /></FormControl>
                  <FormDescription>Layers between Incident and Substrate media.</FormDescription><FormMessage /></FormItem> )} />
               <FormField control={control} name="polarization" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-1 text-sm"><Waves size={14} />Polarization</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select polarization" /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="TE">TE (s-pol)</SelectItem><SelectItem value="TM">TM (p-pol)</SelectItem></SelectContent>
                    </Select><FormMessage /></FormItem> )} />
            </div>
            <Separator />

            {/* --- Sweep Specific Parameters --- */}
            {sweepType === 'wavelength' && ( <>
                <h3 className="text-base font-semibold flex items-center gap-2"><ScanLine size={16}/>Wavelength Sweep Parameters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField control={control} name="minWavelength" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Min Wavelength (nm)</FormLabel><FormControl><Input type="number" step="1" placeholder="e.g., 400" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))}/></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={control} name="maxWavelength" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Max Wavelength (nm)</FormLabel><FormControl><Input type="number" step="1" placeholder="e.g., 700" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))}/></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={control} name="angleOfIncidence" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1 text-sm"><GitCommitHorizontal size={14} />Fixed Angle of Incidence (°)</FormLabel><FormControl><Input type="number" step="0.1" placeholder="e.g., 0" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))}/></FormControl><FormMessage /></FormItem> )} />
                </div> </> )}
            {sweepType === 'angle' && ( <>
                <h3 className="text-base font-semibold flex items-center gap-2"><GitCommitHorizontal size={16}/>Angle Sweep Parameters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField control={control} name="wavelength" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1 text-sm"><ScanLine size={14} />Fixed Wavelength (nm)</FormLabel><FormControl><Input type="number" step="1" placeholder="e.g., 500" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))}/></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={control} name="minAngle" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Min Angle of Incidence (°)</FormLabel><FormControl><Input type="number" step="0.1" placeholder="e.g., 0" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))}/></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={control} name="maxAngle" render={({ field }) => ( <FormItem><FormLabel className="text-sm">Max Angle of Incidence (°)</FormLabel><FormControl><Input type="number" step="0.1" placeholder="e.g., 89.9" {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))}/></FormControl><FormMessage /></FormItem> )} />
                </div> </> )}
            
            {/* --- Stack Visualizer --- */}
            <Separator className="my-6" />
             <div className="my-6">
                 <StackVisualizer
                    incidentMaterialName={incidentMat?.name}
                    substrateMaterialName={substrateMat?.name}
                    internalLayers={internalLayersForVisualizer}
                  />
             </div>


            {/* --- Layer Details Section --- */}
            {(numLayers > 0 && !isNaN(numLayers) && numLayers <= 20) && (
              <>
                <Separator className="my-6" />
                <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><Sparkles size={16}/>Layer Details (Sandwiched between Incident and Substrate Media)</h3>
                {layerMaterialSelectionFields.map((layerField, index) => (
                  <div key={layerField.id} className="p-4 border rounded-md space-y-4 mb-4 shadow-sm bg-card">
                    <h4 className="font-semibold text-sm text-primary">Layer {index + 1}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={control} name={`thickness.${index}`} render={({ field }) => (
                          <FormItem><FormLabel className="flex items-center gap-1 text-sm"><Ruler size={14} />Thickness (nm)</FormLabel>
                          <FormControl><Input type="number" step="0.1" placeholder={`Layer ${index + 1} thickness`} {...field} value={typeof field.value === 'number' && !isNaN(field.value) ? field.value : ''} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                          <FormMessage /></FormItem> )} />

                      <FormField control={control} name={`layerMaterials.${index}.materialId`} render={({ field }) => (
                          <FormItem><FormLabel className="flex items-center gap-1 text-sm"><BookType size={14}/>Material</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ''} >
                              <FormControl><SelectTrigger><SelectValue placeholder="Select a material from library" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {materialLibrary.length === 0 && <SelectItem value="" disabled>No materials in library</SelectItem>}
                                {materialLibrary.map(material => (
                                  <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage /></FormItem> )} />
                    </div>
                  </div>
                ))}
                 {errors.layerMaterials?.message && <p className="text-sm font-medium text-destructive">{errors.layerMaterials.message as string}</p>}
                 {errors.layerMaterials?.root?.message && <p className="text-sm font-medium text-destructive">{errors.layerMaterials.root.message as string}</p>}
              </>
            )}

            {recaptchaSiteKey && (
              <div className="my-6 flex justify-center md:justify-start">
                <ReCAPTCHA ref={recaptchaRef} sitekey={recaptchaSiteKey} />
              </div> )}

            <Button type="submit" disabled={isLoading || isSubmitting} className="w-full md:w-auto mt-6">
              <Calculator size={18} className="mr-2" />
              {isLoading || isSubmitting ? 'Calculating...' : 'Calculate Optical Response'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>

    {/* Material Data Plot Dialog */}
    <Dialog open={isMaterialPlotDialogOpen} onOpenChange={setIsMaterialPlotDialogOpen}>
        <DialogContent className="sm:max-w-[70vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Material Dispersion Data: {plottingMaterialName || "Selected Material"}</DialogTitle>
                <DialogDescription>
                    Plot of Refractive Index (n) and Extinction Coefficient (k) vs. Wavelength.
                </DialogDescription>
            </DialogHeader>
            {plottingMaterialData && plottingMaterialName && (
                <div className="py-4">
                    <MaterialDataChart data={plottingMaterialData} materialName={plottingMaterialName} />
                </div>
            )}
            <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline">Close</Button>
                 </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
