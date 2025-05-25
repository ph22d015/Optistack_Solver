
import { z } from 'zod';

// --- Individual Material Property Schemas (Constant or Dispersive) ---
const ConstantMaterialSchema = z.object({
  type: z.literal('constant'),
  n: z.coerce.number().min(0, "n must be non-negative").default(1.0),
  k: z.coerce.number().min(0, "k must be non-negative").default(0.0),
  materialName: z.string().optional(),
}).describe("Material with fixed n and k values.");

const DispersiveDataPointSchema = z.object({
  wavelength: z.coerce.number().positive("Wavelength must be positive").default(400),
  n: z.coerce.number().min(0, "n must be non-negative").default(1.5),
  k: z.coerce.number().min(0, "k must be non-negative").default(0.0),
});
export type DispersiveDataPoint = z.infer<typeof DispersiveDataPointSchema>;

const DispersiveMaterialSchema = z.object({
  type: z.literal('dispersive'),
  materialName: z.string().optional().describe("Descriptive name for this dispersive material (e.g., SiO2 - Johnson)"),
  data: z.array(DispersiveDataPointSchema)
    .min(2, "At least two data points are needed for interpolation.")
    .default([{ wavelength: 400, n: 1.5, k: 0.0 }, { wavelength: 700, n: 1.5, k: 0.0 }]),
}).describe("Material with n and k values that vary with wavelength, defined by a table.");

export const LayerMaterialPropertiesSchema = z.union([ConstantMaterialSchema, DispersiveMaterialSchema]);
export type LayerMaterialProperties = z.infer<typeof LayerMaterialPropertiesSchema>;

// --- Named Material for the Library ---
export const NamedMaterialSchema = z.object({
  id: z.string().default(() => `mat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`), // Unique ID
  name: z.string().min(1, "Material name cannot be empty."),
  properties: LayerMaterialPropertiesSchema,
});
export type NamedMaterial = z.infer<typeof NamedMaterialSchema>;

const defaultAirMaterialId = 'default-air';
const defaultAirMaterial: NamedMaterial = { id: defaultAirMaterialId, name: 'Air', properties: { type: 'constant', n: 1.0, k: 0.0, materialName: 'Air' } };

export const SolverFormSchema = z.object({
  sweepType: z.enum(['wavelength', 'angle']).default('wavelength').describe("Parameter to sweep in the calculation."),
  
  incidentMediumMaterialId: z.string().min(1, "Incident medium material is required.").default(defaultAirMaterialId).describe("Material ID for the incident medium from the library."),
  substrateMediumMaterialId: z.string().min(1, "Substrate medium material is required.").default(defaultAirMaterialId).describe("Material ID for the substrate medium from the library."),
  
  materialLibrary: z.array(NamedMaterialSchema).min(1, "Material library cannot be empty.").default([defaultAirMaterial]),

  numLayers: z.coerce.number().int().min(0, "Min 0 layers").max(20, "Max 20 layers").default(1),
  thickness: z.array(z.coerce.number().min(0, "Thickness must be non-negative nm. Use 0 for no layer, or >0 for actual thickness.")).default([100]),
  
  layerMaterials: z.array(
    z.object({
      materialId: z.string().min(1, "Please select a material for this layer.") 
    })
  ).default([{ materialId: defaultAirMaterialId }]), 
  
  minWavelength: z.coerce.number().min(1, "Min wavelength must be > 0 nm").default(400),
  maxWavelength: z.coerce.number().min(1, "Max wavelength must be > 0 nm").default(700),
  angleOfIncidence: z.coerce.number().min(0, "Angle must be 0-89.9°").max(89.9, "Angle must be 0-89.9°").default(0).describe("Angle of incidence in degrees for wavelength sweep"),
  
  wavelength: z.coerce.number().min(1, "Wavelength must be > 0 nm").default(500).describe("Single wavelength in nm for angle sweep"),
  minAngle: z.coerce.number().min(0, "Min angle must be 0-89.9°").max(89.9, "Min angle must be 0-89.9°").default(0),
  maxAngle: z.coerce.number().min(0, "Max angle must be 0-89.9°").max(89.9, "Max angle must be 0-89.9°").default(89.9),

  polarization: z.enum(['TE', 'TM'], { required_error: "Polarization is required" }).default('TE').describe("Polarization of light"),
}).refine(data => data.thickness.length === data.numLayers, {
  message: "Thickness entries must match number of layers.",
  path: ["numLayers"],
})
.refine(data => data.layerMaterials.length === data.numLayers, {
  message: "Layer material selections must match number of layers.",
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

  const materialNames = new Set<string>();
  const materialLibraryIds = new Set<string>(data.materialLibrary.map(m => m.id));

  data.materialLibrary.forEach((material, index) => {
    if (materialNames.has(material.name.toLowerCase().trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Material name "${material.name}" is not unique. Please use distinct names.`,
        path: [`materialLibrary.${index}.name`],
      });
    }
    materialNames.add(material.name.toLowerCase().trim());

    if (material.properties.type === 'dispersive') {
      for (let i = 0; i < material.properties.data.length - 1; i++) {
        if (material.properties.data[i].wavelength >= material.properties.data[i+1].wavelength) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Wavelengths in dispersive data for material "${material.name}" must be strictly increasing.`,
            path: [`materialLibrary.${index}.properties.data.${i+1}.wavelength`],
          });
        }
      }
    }
  });
  
  data.layerMaterials.forEach((layer, index) => {
      if (layer.materialId && !materialLibraryIds.has(layer.materialId)) {
          ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Selected material for Layer ${index + 1} is not found in the library.`,
              path: [`layerMaterials.${index}.materialId`],
          });
      }
  });

  if (data.incidentMediumMaterialId && !materialLibraryIds.has(data.incidentMediumMaterialId)) {
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Selected incident medium material is not found in the library.`,
        path: [`incidentMediumMaterialId`],
    });
  }
  if (data.substrateMediumMaterialId && !materialLibraryIds.has(data.substrateMediumMaterialId)) {
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Selected substrate medium material is not found in the library.`,
        path: [`substrateMediumMaterialId`],
    });
  }

});

export type SolverFormValues = z.infer<typeof SolverFormSchema>;

export type SweepParameter = 'wavelength' | 'angle';

export interface OpticalResponsePoint {
  xValue: number; 
  reflectance: number; 
  transmittance: number;
  absorptance: number; 
}

export interface CalculationResults {
  data: OpticalResponsePoint[];
  sweepParameter: SweepParameter; 
}

export const defaultLayerMaterialPropertiesConstant: LayerMaterialProperties = {
  type: 'constant' as const,
  n: 1.0,
  k: 0.0,
  materialName: 'New Constant Material',
};

export const defaultLayerMaterialPropertiesDispersive: LayerMaterialProperties = {
    type: 'dispersive' as const,
    materialName: 'New Dispersive Material',
    data: [
        { wavelength: 400, n: 1.5, k: 0.0 },
        { wavelength: 700, n: 1.5, k: 0.0 }
    ]
};

export const defaultNamedMaterial: NamedMaterial = {
    id: `mat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: "New Material",
    properties: defaultLayerMaterialPropertiesConstant,
}

export const defaultSolverFormValues: SolverFormValues = {
  sweepType: 'wavelength',
  incidentMediumMaterialId: defaultAirMaterialId,
  substrateMediumMaterialId: defaultAirMaterialId,
  materialLibrary: [defaultAirMaterial],
  numLayers: 1, 
  thickness: [100], 
  layerMaterials: [{ materialId: defaultAirMaterialId }],
  
  minWavelength: 400,
  maxWavelength: 700,
  angleOfIncidence: 0,
  
  wavelength: 500,
  minAngle: 0,
  maxAngle: 89.9,

  polarization: 'TE',
};

// For Past Simulations Feature
export interface SavedSimulationEntry {
  id: string;
  name?: string; // Optional user-defined name
  timestamp: number;
  formValues: SolverFormValues;
  results: CalculationResults;
}
