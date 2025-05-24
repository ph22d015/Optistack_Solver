
import { z } from 'zod';

export const LayerParamSchema = z.object({
  value: z.coerce.number().min(0, "Value must be non-negative"),
});

// Schemas for Material Types
const ConstantMaterialSchema = z.object({
  type: z.literal('constant'),
  n: z.coerce.number().min(0, "n must be non-negative").default(1.0),
  k: z.coerce.number().min(0, "k must be non-negative").default(0.0),
}).describe("Material with fixed n and k values.");

const DispersiveDataPointSchema = z.object({
  wavelength: z.coerce.number().positive("Wavelength must be positive").default(400),
  n: z.coerce.number().min(0, "n must be non-negative").default(1.5),
  k: z.coerce.number().min(0, "k must be non-negative").default(0.0),
});

export type DispersiveDataPoint = z.infer<typeof DispersiveDataPointSchema>;

const DispersiveMaterialSchema = z.object({
  type: z.literal('dispersive'),
  materialName: z.string().optional().describe("Optional name for this dispersive material (e.g., SiO2)"),
  data: z.array(DispersiveDataPointSchema)
    .min(2, "At least two data points are needed for interpolation.")
    .default([{ wavelength: 400, n: 1.5, k: 0.0 }, { wavelength: 700, n: 1.5, k: 0.0 }]),
}).describe("Material with n and k values that vary with wavelength, defined by a table.");

export const LayerMaterialSchema = z.union([ConstantMaterialSchema, DispersiveMaterialSchema]);
export type LayerMaterial = z.infer<typeof LayerMaterialSchema>;

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
  numLayers: z.coerce.number().int().min(0, "Min 0 layers").max(20, "Max 20 layers for demo"),
  thickness: z.array(z.coerce.number().min(0, "Thickness must be non-negative nm. Use 0 for no layer, or >0 for actual thickness.")).describe("Layer thicknesses in nm"),
  
  // This is the changed field
  layerMaterials: z.array(LayerMaterialSchema).describe("Material properties for each layer (can be constant or dispersive)."),
  
  // Fields for wavelength sweep
  minWavelength: z.coerce.number().min(1, "Min wavelength must be > 0 nm").default(400),
  maxWavelength: z.coerce.number().min(1, "Max wavelength must be > 0 nm").default(700),
  angleOfIncidence: z.coerce.number().min(0, "Angle must be 0-89.9°").max(89.9, "Angle must be 0-89.9°").default(0).describe("Angle of incidence in degrees for wavelength sweep"),
  
  // Fields for angle sweep
  wavelength: z.coerce.number().min(1, "Wavelength must be > 0 nm").default(500).describe("Single wavelength in nm for angle sweep"),
  minAngle: z.coerce.number().min(0, "Min angle must be 0-89.9°").max(89.9, "Min angle must be 0-89.9°").default(0),
  maxAngle: z.coerce.number().min(0, "Max angle must be 0-89.9°").max(89.9, "Max angle must be 0-89.9°").default(89.9),

  polarization: z.enum(['TE', 'TM'], { required_error: "Polarization is required" }).default('TE').describe("Polarization of light"),
}).refine(data => data.thickness.length === data.numLayers, {
  message: "Thickness entries must match number of layers.",
  path: ["numLayers"],
})
.refine(data => data.layerMaterials.length === data.numLayers, {
  message: "Layer material entries must match number of layers.",
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

  // Validate dispersive data points are sorted by wavelength if present
  data.layerMaterials.forEach((material, index) => {
    if (material.type === 'dispersive') {
      for (let i = 0; i < material.data.length - 1; i++) {
        if (material.data[i].wavelength >= material.data[i+1].wavelength) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Wavelengths in dispersive data for Layer ${index + 1} must be strictly increasing.`,
            path: [`layerMaterials.${index}.data.${i+1}.wavelength`],
          });
        }
      }
    }
  });

});

export type SolverFormValues = z.infer<typeof SolverFormSchema>;

export type SweepParameter = 'wavelength' | 'angle';

export interface OpticalResponsePoint {
  xValue: number; // Will hold either wavelength or angle
  reflectance: number; // 0-1
  transmittance: number; // 0-1
  absorptance: number; // 0-1
}

export interface CalculationResults {
  data: OpticalResponsePoint[];
  sweepParameter: SweepParameter; 
}

export const defaultLayerMaterialConstant: LayerMaterial = {
  type: 'constant' as const,
  n: 1.0,
  k: 0.0,
};

export const defaultLayerMaterialDispersive: LayerMaterial = {
    type: 'dispersive' as const,
    materialName: '',
    data: [
        { wavelength: 400, n: 1.5, k: 0.0 },
        { wavelength: 700, n: 1.5, k: 0.0 }
    ]
};


export const defaultSolverFormValues: SolverFormValues = {
  sweepType: 'wavelength',
  incidentMediumRefractiveIndex: { n: 1.0, k: 0.0 },
  substrateMediumRefractiveIndex: { n: 1.0, k: 0.0 },
  numLayers: 1, 
  thickness: [100], 
  layerMaterials: [defaultLayerMaterialConstant], // Default to one constant layer
  
  minWavelength: 400,
  maxWavelength: 700,
  angleOfIncidence: 0,
  
  wavelength: 500,
  minAngle: 0,
  maxAngle: 89.9,

  polarization: 'TE',
};

