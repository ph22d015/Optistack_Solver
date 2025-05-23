
import { z } from 'zod';

export const LayerParamSchema = z.object({
  value: z.coerce.number().min(0, "Value must be non-negative"),
});

export const ComplexRefractiveIndexSchema = z.object({
  n: z.coerce.number().min(0, "n must be non-negative").describe("Real part of refractive index"), // n can be < 1 for metals, >= 0
  k: z.coerce.number().min(0, "k must be non-negative").describe("Extinction coefficient (imaginary part)"),
}).refine(data => data.n >= 1.0 || data.k > 0 || (data.n === 0 && data.k === 0) || (data.n < 1.0 && data.n > 0 && data.k > 0) , { // Allow n=0,k=0 for vacuum/perfect conductor idealization; allow n<1 for metals if k>0
    message: "If k is 0 (or very small), n should generally be >= 1.0. For k > 0 (absorbing media/metals), n can be < 1. n=0, k=0 is a special case.",
    path: ["n"],
});


export const SolverFormSchema = z.object({
  incidentMediumRefractiveIndex: ComplexRefractiveIndexSchema.describe("Refractive index of the incident medium"),
  substrateMediumRefractiveIndex: ComplexRefractiveIndexSchema.describe("Refractive index of the substrate medium"),
  numLayers: z.coerce.number().int().min(0, "Min 0 layers").max(10, "Max 10 layers for demo"),
  thickness: z.array(z.coerce.number().min(0.1, "Thickness must be > 0 nm")).describe("Layer thicknesses in nm"),
  refractiveIndex: z.array(ComplexRefractiveIndexSchema).describe("Layer complex refractive indices"),
  angleOfIncidence: z.coerce.number().min(0, "Angle must be 0-90°").max(90, "Angle must be 0-90°").describe("Angle of incidence in degrees"),
  polarization: z.enum(['TE', 'TM'], { required_error: "Polarization is required" }).describe("Polarization of light"),
  minWavelength: z.coerce.number().min(1, "Min wavelength must be > 0 nm").default(400),
  maxWavelength: z.coerce.number().min(1, "Max wavelength must be > 0 nm").default(700),
}).refine(data => data.thickness.length === data.numLayers, {
  message: "Thickness entries must match number of layers.",
  path: ["numLayers"],
})
.refine(data => data.refractiveIndex.length === data.numLayers, {
  message: "Refractive index entries must match number of layers.",
  path: ["numLayers"],
})
.refine(data => data.maxWavelength > data.minWavelength, {
  message: "Max wavelength must be greater than min wavelength.",
  path: ["maxWavelength"],
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
  absorptance: number; // 0-1
}

export interface CalculationResults {
  data: OpticalResponsePoint[];
  aiFeedback?: AiFeedback;
}

export const defaultSolverFormValues: SolverFormValues = {
  incidentMediumRefractiveIndex: { n: 1.0, k: 0.0 }, // Air
  substrateMediumRefractiveIndex: { n: 1.0, k: 0.0 }, // Air
  numLayers: 1, // Default to 1 layer
  thickness: [100], // Default thickness for the first layer (e.g., 100nm)
  refractiveIndex: [{ n: 1.0, k: 0.0 }], // Default n, k for the first layer
  angleOfIncidence: 0,
  polarization: 'TE',
  minWavelength: 400,
  maxWavelength: 700,
};

