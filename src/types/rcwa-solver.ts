
import { z } from 'zod';
import { defaultAirMaterialId } from '@/types/solver'; // Reuse for default material selection

export const RcwaSolverFormSchema = z.object({
  // Global Parameters
  wavelength: z.coerce.number().positive("Wavelength must be > 0 nm").default(500),
  incidentAngleTheta: z.coerce.number().min(0).max(89.9).default(0).describe("Incident angle Theta (degrees) from Z-axis"),
  incidentAnglePhi: z.coerce.number().min(0).max(360).default(0).describe("Incident angle Phi (degrees) in XY-plane from X-axis"),
  polarization: z.enum(['TE', 'TM']).default('TE').describe("Polarization of incident light"),

  // 1D Binary Grating Definition
  gratingPeriod: z.coerce.number().positive("Period must be > 0 nm").default(300),
  gratingThickness: z.coerce.number().positive("Thickness must be > 0 nm").default(100),
  ridgeMaterialId: z.string().min(1, "Ridge material is required").default(defaultAirMaterialId).describe("Material ID for the grating ridge from the library"),
  grooveMaterialId: z.string().min(1, "Groove material is required").default(defaultAirMaterialId).describe("Material ID for the grating groove from the library"),
  dutyCycle: z.coerce.number().min(0.01, "Duty cycle must be > 0").max(0.99, "Duty cycle must be < 1").default(0.5).describe("Ridge width / Period (0 to 1)"),
  
  // Surrounding Media (can be selected from the main material library)
  incidentMediumMaterialId: z.string().min(1, "Incident medium is required").default(defaultAirMaterialId),
  substrateMediumMaterialId: z.string().min(1, "Substrate medium is required").default(defaultAirMaterialId),

  // Simulation Settings (Placeholders for now)
  numHarmonics: z.coerce.number().int().positive("Number of harmonics must be positive").default(10),

  // Material Library will be implicitly available from the main SolverFormValues or a shared context if needed later
});

export type RcwaSolverFormValues = z.infer<typeof RcwaSolverFormSchema>;

export const defaultRcwaSolverFormValues: RcwaSolverFormValues = {
  wavelength: 500,
  incidentAngleTheta: 0,
  incidentAnglePhi: 0,
  polarization: 'TE',
  gratingPeriod: 300,
  gratingThickness: 100,
  ridgeMaterialId: defaultAirMaterialId, // Default to Air, user should change
  grooveMaterialId: defaultAirMaterialId, // Default to Air, user should change
  dutyCycle: 0.5,
  incidentMediumMaterialId: defaultAirMaterialId,
  substrateMediumMaterialId: defaultAirMaterialId,
  numHarmonics: 10,
};
