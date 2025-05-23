// src/ai/flows/validate-input-parameters.ts
'use server';

/**
 * @fileOverview AI-powered input parameter validation for the OptiStack Solver.
 *
 * This file defines a Genkit flow that validates user-provided input parameters
 * (thickness, complex refractive index, angle of incidence, wavelength range) for the OptiStack Solver.
 * It provides warnings and suggestions if the inputs are outside typical ranges,
 * helping users avoid errors and ensuring physically plausible simulations.
 *
 * @exports validateInputParameters - The main function to validate input parameters.
 * @exports ValidateInputParametersInput - The input type for the validateInputParameters function.
 * @exports ValidateInputParametersOutput - The output type for the validateInputParameters function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { ComplexRefractiveIndexSchema } from '@/types/solver'; // Use existing schema if compatible

const ComplexRefractiveIndexInputSchema = z.object({
  n: z.number().describe("Real part of refractive index"),
  k: z.number().describe("Extinction coefficient (imaginary part)"),
});

const ValidateInputParametersInputSchema = z.object({
  numLayers: z.number().describe('The number of layers in the stack.'),
  thickness: z.array(z.number()).describe('An array of layer thicknesses in nanometers.'),
  refractiveIndex: z.array(ComplexRefractiveIndexInputSchema).describe('An array of complex refractive indices (n, k) for each layer.'),
  angleOfIncidence: z.number().describe('The angle of incidence in degrees.'),
  polarization: z.enum(['TE', 'TM']).describe('The polarization of light (TE or TM).'),
  minWavelength: z.number().describe('Minimum wavelength of interest in nanometers.'),
  maxWavelength: z.number().describe('Maximum wavelength of interest in nanometers.'),
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

  Parameters:
  Number of Layers: {{{numLayers}}}
  Thicknesses (nm): {{#each thickness}}{{{this}}} {{/each}}
  Refractive Indices (n, k): {{#each refractiveIndex}}n={{this.n}}, k={{this.k}}; {{/each}}
  Angle of Incidence (degrees): {{{angleOfIncidence}}}
  Polarization: {{{polarization}}}
  Wavelength Range (nm): {{{minWavelength}}} to {{{maxWavelength}}}

  Consider typical material properties and physical limitations.
  - Refractive indices 'n' are typically between 1.0 and 4.0 for most materials in the visible to NIR spectrum. Values outside this might be for specific materials or UV/IR ranges; flag if significantly outside.
  - Extinction coefficients 'k' are non-negative. For transparent or weakly absorbing materials, 'k' is very small (e.g., 0 to 0.1). Higher 'k' means strong absorption (metals).
  - Thicknesses should be positive values, typically from a few nanometers to micrometers.
  - Angle of incidence should be between 0 and 90 degrees.
  - Wavelength range should be physically reasonable (e.g., min < max, positive values). Typical optical ranges are UV (200-400nm), Visible (400-700nm), NIR (700-2500nm).

  Output warnings and suggestions as needed.
  If everything seems correct, the warnings and suggestions arrays should be empty.
  Do not suggest/recommend changing values that are within appropriate ranges.
  If minWavelength or maxWavelength are very far from typical optical ranges (e.g. <100nm or >5000nm for general purpose), you can mention it.
  If k is large (e.g. > 1) while n is small (e.g. < 1.5), it might be unusual, note it unless it's a metal.
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
