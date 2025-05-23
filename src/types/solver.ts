
import { z } from 'zod';

export const LayerParamSchema = z.object({
  value: z.coerce.number().min(0, "Value must be non-negative"),
});

export const ComplexRefractiveIndexSchema = z.object({
  n: z.coerce.number().min(1.0, "n must be >= 1.0 (or >=0 for k>0)").describe("Real part of refractive index"),
  k: z.coerce.number().min(0, "k must be non-negative").describe("Extinction coefficient (imaginary part)"),
}).refine(data => data.n >= 0 || data.k == 0, { // n can be < 1 for metals if k > 0, but for dielectrics n usually >=1
    message: "If k > 0, n can be < 1. Otherwise n should be >= 1.0.",
    path: ["n"],
});


export const SolverFormSchema = z.object({
  incidentMediumRefractiveIndex: ComplexRefractiveIndexSchema.describe("Refractive index of the incident medium"),
  substrateMediumRefractiveIndex: ComplexRefractiveIndexSchema.describe("Refractive index of the substrate medium"),
  numLayers: z.coerce.number().int().min(0, "Min 0 layers").max(10, "Max 10 layers for demo"), // Min 0 layers if incident/substrate are defined
  thickness: z.array(z.coerce.number().min(0.1, "Thickness > 0 nm")).describe("Layer thicknesses in nm"),
  refractiveIndex: z.array(ComplexRefractiveIndexSchema).describe("Layer complex refractive indices"),
  angleOfIncidence: z.coerce.number().min(0, "Angle: 0-90°").max(90, "Angle: 0-90°").describe("Angle of incidence in degrees"),
  polarization: z.enum(['TE', 'TM'], { required_error: "Polarization is required" }).describe("Polarization of light"),
  minWavelength: z.coerce.number().min(1, "Min wavelength > 0 nm").default(400),
  maxWavelength: z.coerce.number().min(1, "Max wavelength > 0 nm").default(700),
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
  incidentMediumRefractiveIndex: { n: 1.0, k: 0.0 }, // Air/Vacuum
  substrateMediumRefractiveIndex: { n: 1.5, k: 0.0 }, // Typical Glass
  numLayers: 2,
  thickness: [100, 100],
  refractiveIndex: [
    { n: 1.5, k: 0 },
    { n: 2.0, k: 0.01 },
  ],
  angleOfIncidence: 0,
  polarization: 'TE',
  minWavelength: 400,
  maxWavelength: 700,
};

