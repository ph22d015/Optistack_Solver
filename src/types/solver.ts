
import { z } from 'zod';

export const LayerParamSchema = z.object({
  value: z.coerce.number().min(0, "Value must be non-negative"),
});

export const ComplexRefractiveIndexSchema = z.object({
  n: z.coerce.number().min(0, "n must be non-negative").describe("Real part of refractive index"),
  k: z.coerce.number().min(0, "k must be non-negative").describe("Extinction coefficient (imaginary part)"),
}).refine(data => data.n >= 1.0 || data.k > 0 || (data.n === 0 && data.k === 0) || (data.n < 1.0 && data.n > 0 && data.k > 0) , {
    message: "If k is 0 (or very small), n should generally be >= 1.0. For k > 0 (absorbing media/metals), n can be < 1. n=0, k=0 is a special case.",
    path: ["n"],
});


export const SolverFormSchema = z.object({
  sweepType: z.enum(['wavelength', 'angle']).default('wavelength').describe("Parameter to sweep in the calculation."),
  incidentMediumRefractiveIndex: ComplexRefractiveIndexSchema.describe("Refractive index of the incident medium"),
  substrateMediumRefractiveIndex: ComplexRefractiveIndexSchema.describe("Refractive index of the substrate medium"),
  numLayers: z.coerce.number().int().min(0, "Min 0 layers").max(10, "Max 10 layers for demo"),
  thickness: z.array(z.coerce.number().min(0, "Thickness must be non-negative nm. Use 0 for no layer, or >0 for actual thickness.")).describe("Layer thicknesses in nm"),
  refractiveIndex: z.array(ComplexRefractiveIndexSchema).describe("Layer complex refractive indices"),
  
  // Fields for wavelength sweep
  minWavelength: z.coerce.number().min(1, "Min wavelength must be > 0 nm").default(400),
  maxWavelength: z.coerce.number().min(1, "Max wavelength must be > 0 nm").default(700),
  angleOfIncidence: z.coerce.number().min(0, "Angle must be 0-89.9°").max(89.9, "Angle must be 0-89.9°").default(0).describe("Angle of incidence in degrees for wavelength sweep"),
  
  // Fields for angle sweep
  wavelength: z.coerce.number().min(1, "Wavelength must be > 0 nm").default(500).describe("Single wavelength in nm for angle sweep"),
  minAngle: z.coerce.number().min(0, "Min angle must be 0-89.9°").max(89.9, "Min angle must be 0-89.9°").default(0),
  maxAngle: z.coerce.number().min(0, "Max angle must be 0-89.9°").max(89.9, "Max angle must be 0-89.9°").default(89.9),

  polarization: z.enum(['TE', 'TM'], { required_error: "Polarization is required" }).describe("Polarization of light"),
}).refine(data => data.thickness.length === data.numLayers, {
  message: "Thickness entries must match number of layers.",
  path: ["numLayers"],
})
.refine(data => data.refractiveIndex.length === data.numLayers, {
  message: "Refractive index entries must match number of layers.",
  path: ["numLayers"],
})
.superRefine((data, ctx) => {
  if (data.sweepType === 'wavelength') {
    if (data.minWavelength <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Min wavelength must be positive.", path: ["minWavelength"] });
    }
    if (data.maxWavelength <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Max wavelength must be positive.", path: ["maxWavelength"] });
    }
    if (data.maxWavelength <= data.minWavelength) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Max wavelength must be greater than min wavelength.",
        path: ["maxWavelength"],
      });
    }
  } else if (data.sweepType === 'angle') {
     if (data.wavelength <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fixed wavelength must be positive.", path: ["wavelength"] });
    }
    if (data.maxAngle <= data.minAngle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Max angle must be greater than min angle.",
        path: ["maxAngle"],
      });
    }
  }
});

export type SolverFormValues = z.infer<typeof SolverFormSchema>;

// AiFeedback interface is removed

export type SweepParameter = 'wavelength' | 'angle';

export interface OpticalResponsePoint {
  xValue: number; // Will hold either wavelength or angle
  reflectance: number; // 0-1
  transmittance: number; // 0-1
  absorptance: number; // 0-1
}

export interface CalculationResults {
  data: OpticalResponsePoint[];
  sweepParameter: SweepParameter; // To tell the chart what xValue represents
  // aiFeedback field is removed
}

export const defaultSolverFormValues: SolverFormValues = {
  sweepType: 'wavelength',
  incidentMediumRefractiveIndex: { n: 1.0, k: 0.0 },
  substrateMediumRefractiveIndex: { n: 1.0, k: 0.0 },
  numLayers: 1, // Default to 1 layer
  thickness: [100], 
  refractiveIndex: [{ n: 1.0, k: 0.0 }], // Default RI for the 1 layer
  
  minWavelength: 400,
  maxWavelength: 700,
  angleOfIncidence: 0,
  
  wavelength: 500,
  minAngle: 0,
  maxAngle: 89.9,

  polarization: 'TE',
};
