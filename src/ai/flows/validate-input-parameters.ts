
// src/ai/flows/validate-input-parameters.ts
'use server';

/**
 * @fileOverview AI-powered input parameter validation for the OptiStack Solver.
 *
 * This file defines a Genkit flow that validates user-provided input parameters
 * for the OptiStack Solver. It provides warnings and suggestions if the inputs are outside typical ranges,
 * helping users avoid errors and ensuring physically plausible simulations.
 *
 * @exports validateInputParameters - The main function to validate input parameters.
 * @exports ValidateInputParametersInput - The input type for the validateInputParameters function.
 * @exports ValidateInputParametersOutput - The output type for the validateInputParameters function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ComplexRefractiveIndexInputSchema = z.object({
  n: z.number().describe("Real part of refractive index"),
  k: z.number().describe("Extinction coefficient (imaginary part)"),
});

// This schema now includes all possible fields; the prompt will clarify context.
const ValidateInputParametersInputSchema = z.object({
  sweepType: z.enum(['wavelength', 'angle']).describe("The type of sweep being performed."),
  incidentMediumRefractiveIndex: ComplexRefractiveIndexInputSchema.describe("Refractive index of the incident (top) medium."),
  substrateMediumRefractiveIndex: ComplexRefractiveIndexInputSchema.describe("Refractive index of the substrate (bottom) medium."),
  numLayers: z.number().describe('The number of layers in the stack (between incident and substrate).'),
  thickness: z.array(z.number()).describe('An array of layer thicknesses in nanometers.'),
  refractiveIndex: z.array(ComplexRefractiveIndexInputSchema).describe('An array of complex refractive indices (n, k) for each layer.'),
  
  // Wavelength sweep specific
  minWavelength: z.number().optional().describe('Minimum wavelength of interest in nanometers (for wavelength sweep).'),
  maxWavelength: z.number().optional().describe('Maximum wavelength of interest in nanometers (for wavelength sweep).'),
  angleOfIncidence: z.number().optional().describe('The fixed angle of incidence in degrees (for wavelength sweep).'),

  // Angle sweep specific
  wavelength: z.number().optional().describe('The fixed wavelength in nanometers (for angle sweep).'),
  minAngle: z.number().optional().describe('Minimum angle of incidence in degrees (for angle sweep).'),
  maxAngle: z.number().optional().describe('Maximum angle of incidence in degrees (for angle sweep).'),
  
  polarization: z.enum(['TE', 'TM']).describe('The polarization of light (TE or TM).'),
});
export type ValidateInputParametersInput = z.infer<typeof ValidateInputParametersInputSchema>;

const ValidateInputParametersOutputSchema = z.object({
  warnings: z.array(z.string()).describe('An array of warnings for out-of-range parameters.'),
  suggestions: z.array(z.string()).describe('An array of suggestions for correcting the parameters.'),
});
export type ValidateInputParametersOutput = z.infer<typeof ValidateInputParametersOutputSchema>;


export async function validateInputParameters(input: ValidateInputParametersInput): Promise<ValidateInputParametersOutput> {
  return validateInputParametersFlow(input);
}

const validateInputParametersPrompt = ai.definePrompt({
  name: 'validateInputParametersPrompt',
  input: {schema: ValidateInputParametersInputSchema},
  output: {schema: ValidateInputParametersOutputSchema},
  prompt: `You are an expert in optics and thin-film interference.
  Your task is to validate the input parameters for an optical simulation.
  Provide warnings if any of the parameters are outside typical or physically plausible ranges.
  Suggest reasonable values if possible.

  The user is performing a sweep of type: {{{sweepType}}}

  Parameters:
  Incident Medium Refractive Index (n, k): n={{incidentMediumRefractiveIndex.n}}, k={{incidentMediumRefractiveIndex.k}}
  Substrate Medium Refractive Index (n, k): n={{substrateMediumRefractiveIndex.n}}, k={{substrateMediumRefractiveIndex.k}}
  Number of Internal Layers: {{{numLayers}}}
  Internal Layer Thicknesses (nm): {{#if thickness.length}}{{#each thickness}}{{{this}}} {{/each}}{{else}}N/A{{/if}}
  Internal Layer Refractive Indices (n, k): {{#if refractiveIndex.length}}{{#each refractiveIndex}}n={{this.n}}, k={{this.k}}; {{/each}}{{else}}N/A{{/if}}
  Polarization: {{{polarization}}}

  {{#if (eq sweepType "wavelength")}}
  Wavelength Sweep Details:
  - Wavelength Range (nm): {{{minWavelength}}} to {{{maxWavelength}}}
  - Fixed Angle of Incidence (degrees, in incident medium): {{{angleOfIncidence}}}
  {{/if}}

  {{#if (eq sweepType "angle")}}
  Angle Sweep Details:
  - Fixed Wavelength (nm): {{{wavelength}}}
  - Angle of Incidence Range (degrees, in incident medium): {{{minAngle}}} to {{{maxAngle}}}
  {{/if}}

  Consider typical material properties and physical limitations:
  - Incident Medium: Often air (n~1, k=0) or vacuum. Could be water (n~1.33, k~0) or other transparent materials.
  - Substrate Medium: Could be glass (n~1.5, k~0), silicon (n~3.5-4 in visible/NIR, k can vary), metals (e.g., gold, silver - n<1 or higher, k>0 significant).
  - Internal Layers:
    - Refractive indices 'n' are typically between 1.0 and 4.0 for most dielectrics in the visible to NIR spectrum. Values outside this might be for specific materials (e.g. metals, some semiconductors) or UV/IR ranges; flag if significantly outside for a dielectric. For metals, n can be < 1.
    - Extinction coefficients 'k' are non-negative. For transparent or weakly absorbing materials, 'k' is very small (e.g., 0 to 0.1). Higher 'k' means strong absorption (metals).
    - Thicknesses should be positive values, typically from a few nanometers to micrometers. Zero layers means direct interface between incident and substrate.
  - Angle of incidence should be between 0 and 89.9 degrees (to avoid pure grazing incidence issues in calculations). Values of 90 degrees might lead to singularities.
  - Wavelength range should be physically reasonable (e.g., min < max, positive values). Typical optical ranges are UV (200-400nm), Visible (400-700nm), NIR (700-2500nm).
  - Fixed wavelength for angle sweeps should also be in a typical optical range.

  Output warnings and suggestions as needed.
  If everything seems correct, the warnings and suggestions arrays should be empty.
  Do not suggest/recommend changing values that are within appropriate ranges.
  If minWavelength/maxWavelength or fixed wavelength are very far from typical optical ranges (e.g. <100nm or >5000nm for general purpose), you can mention it.
  If k is large (e.g. > 1) while n is small (e.g. < 1.5) for any layer (including incident/substrate), it might be unusual for a dielectric, note it unless specified as a metal or known semiconductor.
  If numLayers is 0, then internal layer parameters are not applicable.
  If sweepType is 'wavelength', ensure minWavelength < maxWavelength and angleOfIncidence is valid.
  If sweepType is 'angle', ensure minAngle < maxAngle and wavelength is valid.
  `,
});

const validateInputParametersFlow = ai.defineFlow(
  {
    name: 'validateInputParametersFlow',
    inputSchema: ValidateInputParametersInputSchema,
    outputSchema: ValidateInputParametersOutputSchema,
  },
  async input => {
    const {output} = await validateInputParametersPrompt(input);
    return output!;
  }
);
