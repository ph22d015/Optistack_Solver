import { z } from 'zod';

export const LayerParamSchema = z.object({
  value: z.coerce.number().min(0, "Value must be non-negative"),
});

export const SolverFormSchema = z.object({
  numLayers: z.coerce.number().int().min(1, "Min 1 layer").max(10, "Max 10 layers for demo"),
  thickness: z.array(z.coerce.number().min(0.1, "Thickness > 0 nm")).describe("Layer thicknesses in nm"),
  refractiveIndex: z.array(z.coerce.number().min(1.0, "Refractive index >= 1.0")).describe("Layer refractive indices"),
  angleOfIncidence: z.coerce.number().min(0, "Angle: 0-90°").max(90, "Angle: 0-90°").describe("Angle of incidence in degrees"),
  polarization: z.enum(['TE', 'TM'], { required_error: "Polarization is required" }).describe("Polarization of light"),
}).refine(data => data.thickness.length === data.numLayers, {
  message: "Thickness entries must match number of layers.",
  path: ["numLayers"],
})
.refine(data => data.refractiveIndex.length === data.numLayers, {
  message: "Refractive index entries must match number of layers.",
  path: ["numLayers"],
});

export type SolverFormValues = z.infer<typeof SolverFormSchema>;

export interface AiFeedback {
  warnings: string[];
  suggestions: string[];
}

export interface OpticalResponsePoint {
  wavelength: number; // nm
  reflectance: number; // 0-1
  transmittance: number; // 0-1
}

export interface CalculationResults {
  data: OpticalResponsePoint[];
  aiFeedback?: AiFeedback;
}

export const defaultSolverFormValues: SolverFormValues = {
  numLayers: 2,
  thickness: [100, 100],
  refractiveIndex: [1.5, 2.0],
  angleOfIncidence: 0,
  polarization: 'TE',
};
