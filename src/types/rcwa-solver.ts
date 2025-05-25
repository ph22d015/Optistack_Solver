
'use client';

import { z } from 'zod';
import { 
    NamedMaterialSchema, 
    defaultAirMaterialId, 
    defaultAirMaterial,
    type NamedMaterial // Ensure NamedMaterial type is imported if used
} from '@/types/solver'; // Re-use from TMM solver

export const RcwaSolverFormSchema = z.object({
  // --- Material Library ---
  materialLibrary: z.array(NamedMaterialSchema).min(1, "Material library cannot be empty.").default([defaultAirMaterial]),

  // --- Global Parameters ---
  wavelength: z.coerce.number().positive("Wavelength must be > 0 nm").default(500),
  incidentAngleTheta: z.coerce.number().min(0).max(89.9).default(0).describe("Incident angle Theta (degrees) from Z-axis"),
  incidentAnglePhi: z.coerce.number().min(0).max(360).default(0).describe("Incident angle Phi (degrees) in XY-plane from X-axis"),
  polarization: z.enum(['TE', 'TM']).default('TE').describe("Polarization of incident light"),
  numHarmonics: z.coerce.number().int().positive("Number of harmonics must be positive").default(10),

  // --- Grating Structure Definition ---
  dimensionality: z.enum(['1D', '2D']).default('1D'),

  // --- Parameters for 1D Grating (Conditional) ---
  gratingPeriod1D: z.coerce.number().positive("1D Grating Period must be > 0 nm").optional(),
  gratingThickness1D: z.coerce.number().positive("1D Grating Thickness must be > 0 nm").optional(),
  ridgeMaterialId1D: z.string().optional().describe("Material ID for the 1D grating ridge"),
  grooveMaterialId1D: z.string().optional().describe("Material ID for the 1D grating groove (fill factor)"),
  dutyCycle1D: z.coerce.number().min(0.01, "1D Duty cycle must be > 0").max(0.99, "1D Duty cycle must be < 1").optional().describe("Ridge width / Period (0 to 1) for 1D grating"),

  // --- Parameters for 2D Grating (Conditional) ---
  periodX2D: z.coerce.number().positive("2D Period X must be > 0 nm").optional(),
  periodY2D: z.coerce.number().positive("2D Period Y must be > 0 nm").optional(),
  gratingThickness2D: z.coerce.number().positive("2D Grating Thickness must be > 0 nm").optional(),
  backgroundMaterialId2D: z.string().optional().describe("Material ID for the 2D grating background medium within the unit cell"),
  
  featureShape2D: z.enum(['circle', 'square', 'rectangle']).optional(),
  featureMaterialId2D: z.string().optional().describe("Material ID for the 2D grating feature"),
  
  // Shape-specific dimensions for 2D features
  circleRadius2D: z.coerce.number().positive("Circle radius must be > 0 nm").optional(),
  squareSide2D: z.coerce.number().positive("Square side length must be > 0 nm").optional(),
  rectangleWidth2D: z.coerce.number().positive("Rectangle width must be > 0 nm").optional(),
  rectangleHeight2D: z.coerce.number().positive("Rectangle height must be > 0 nm").optional(),
  
  // --- Surrounding Media ---
  incidentMediumMaterialId: z.string().min(1, "Incident medium is required").default(defaultAirMaterialId),
  substrateMediumMaterialId: z.string().min(1, "Substrate medium is required").default(defaultAirMaterialId),
})
.superRefine((data, ctx) => {
  const materialIds = new Set(data.materialLibrary.map(m => m.id));

  if (data.dimensionality === '1D') {
    if (data.gratingPeriod1D === undefined) ctx.addIssue({ path: ['gratingPeriod1D'], message: '1D Grating Period is required for 1D structures.', code: z.ZodIssueCode.custom });
    if (data.gratingThickness1D === undefined) ctx.addIssue({ path: ['gratingThickness1D'], message: '1D Grating Thickness is required for 1D structures.', code: z.ZodIssueCode.custom });
    if (!data.ridgeMaterialId1D) ctx.addIssue({ path: ['ridgeMaterialId1D'], message: 'Ridge material is required for 1D grating.', code: z.ZodIssueCode.custom });
    else if (data.ridgeMaterialId1D && !materialIds.has(data.ridgeMaterialId1D)) ctx.addIssue({ path: ['ridgeMaterialId1D'], message: 'Selected ridge material not found in library.', code: z.ZodIssueCode.custom });
    if (!data.grooveMaterialId1D) ctx.addIssue({ path: ['grooveMaterialId1D'], message: 'Groove material is required for 1D grating.', code: z.ZodIssueCode.custom });
    else if (data.grooveMaterialId1D && !materialIds.has(data.grooveMaterialId1D)) ctx.addIssue({ path: ['grooveMaterialId1D'], message: 'Selected groove material not found in library.', code: z.ZodIssueCode.custom });
    if (data.dutyCycle1D === undefined) ctx.addIssue({ path: ['dutyCycle1D'], message: 'Duty Cycle is required for 1D grating.', code: z.ZodIssueCode.custom });
  } else if (data.dimensionality === '2D') {
    if (data.periodX2D === undefined) ctx.addIssue({ path: ['periodX2D'], message: 'Period X is required for 2D structures.', code: z.ZodIssueCode.custom });
    if (data.periodY2D === undefined) ctx.addIssue({ path: ['periodY2D'], message: 'Period Y is required for 2D structures.', code: z.ZodIssueCode.custom });
    if (data.gratingThickness2D === undefined) ctx.addIssue({ path: ['gratingThickness2D'], message: 'Grating Thickness is required for 2D structures.', code: z.ZodIssueCode.custom });
    if (!data.backgroundMaterialId2D) ctx.addIssue({ path: ['backgroundMaterialId2D'], message: 'Background material is required for 2D grating.', code: z.ZodIssueCode.custom });
    else if (data.backgroundMaterialId2D && !materialIds.has(data.backgroundMaterialId2D)) ctx.addIssue({ path: ['backgroundMaterialId2D'], message: 'Selected background material not found in library.', code: z.ZodIssueCode.custom });
    
    if (!data.featureShape2D) ctx.addIssue({ path: ['featureShape2D'], message: 'Feature shape is required for 2D grating.', code: z.ZodIssueCode.custom });
    else {
      if (!data.featureMaterialId2D) ctx.addIssue({ path: ['featureMaterialId2D'], message: 'Feature material is required for 2D grating.', code: z.ZodIssueCode.custom });
      else if (data.featureMaterialId2D && !materialIds.has(data.featureMaterialId2D)) ctx.addIssue({ path: ['featureMaterialId2D'], message: 'Selected feature material not found in library.', code: z.ZodIssueCode.custom });

      if (data.featureShape2D === 'circle' && data.circleRadius2D === undefined) ctx.addIssue({ path: ['circleRadius2D'], message: 'Radius is required for circular feature.', code: z.ZodIssueCode.custom });
      if (data.featureShape2D === 'square' && data.squareSide2D === undefined) ctx.addIssue({ path: ['squareSide2D'], message: 'Side length is required for square feature.', code: z.ZodIssueCode.custom });
      if (data.featureShape2D === 'rectangle') {
        if (data.rectangleWidth2D === undefined) ctx.addIssue({ path: ['rectangleWidth2D'], message: 'Width is required for rectangular feature.', code: z.ZodIssueCode.custom });
        if (data.rectangleHeight2D === undefined) ctx.addIssue({ path: ['rectangleHeight2D'], message: 'Height is required for rectangular feature.', code: z.ZodIssueCode.custom });
      }
    }
  }

  if (data.incidentMediumMaterialId && !materialIds.has(data.incidentMediumMaterialId)) {
    ctx.addIssue({ path: ['incidentMediumMaterialId'], message: 'Selected incident medium not found in library.', code: z.ZodIssueCode.custom });
  }
  if (data.substrateMediumMaterialId && !materialIds.has(data.substrateMediumMaterialId)) {
    ctx.addIssue({ path: ['substrateMediumMaterialId'], message: 'Selected substrate medium not found in library.', code: z.ZodIssueCode.custom });
  }
  
  // Ensure material names in library are unique
  const materialNamesSet = new Set<string>();
  data.materialLibrary.forEach((material, index) => {
    if (materialNamesSet.has(material.name.toLowerCase().trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Material name "${material.name}" is not unique. Please use distinct names.`,
        path: [`materialLibrary.${index}.name`],
      });
    }
    materialNamesSet.add(material.name.toLowerCase().trim());

    // Validate dispersive data if present (e.g. sorted wavelengths)
    if (material.properties.type === 'dispersive') {
      const sortedData = [...material.properties.data].sort((a,b) => a.wavelength - b.wavelength);
      for (let i = 0; i < sortedData.length - 1; i++) {
        if (sortedData[i].wavelength >= sortedData[i+1].wavelength) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Wavelengths in dispersive data for material "${material.name}" must be strictly increasing.`,
            path: [`materialLibrary.${index}.properties.data.${i+1}.wavelength`],
          });
          break;
        }
      }
    }
  });
});

export type RcwaSolverFormValues = z.infer<typeof RcwaSolverFormSchema>;

export const defaultRcwaSolverFormValues: RcwaSolverFormValues = {
  materialLibrary: [defaultAirMaterial],
  wavelength: 500,
  incidentAngleTheta: 0,
  incidentAnglePhi: 0,
  polarization: 'TE',
  numHarmonics: 10,
  dimensionality: '1D',
  // 1D defaults
  gratingPeriod1D: 300,
  gratingThickness1D: 100,
  ridgeMaterialId1D: defaultAirMaterialId,
  grooveMaterialId1D: defaultAirMaterialId,
  dutyCycle1D: 0.5,
  // 2D defaults (optional fields will be undefined unless set)
  periodX2D: 300,
  periodY2D: 300,
  gratingThickness2D: 100,
  backgroundMaterialId2D: defaultAirMaterialId,
  featureShape2D: 'circle',
  featureMaterialId2D: defaultAirMaterialId,
  circleRadius2D: 50,
  // squareSide2D: undefined,
  // rectangleWidth2D: undefined,
  // rectangleHeight2D: undefined,
  incidentMediumMaterialId: defaultAirMaterialId,
  substrateMediumMaterialId: defaultAirMaterialId,
};

// Types for Material Library (re-export for clarity if needed in RCWA page)
export type { 
    NamedMaterial as RcwaNamedMaterial, 
    LayerMaterialProperties as RcwaLayerMaterialProperties,
    DispersiveDataPoint as RcwaDispersiveDataPoint 
} from '@/types/solver';

    