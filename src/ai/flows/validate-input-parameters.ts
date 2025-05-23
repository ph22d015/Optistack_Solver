// src/ai/flows/validate-input-parameters.ts
'use server';

/**
 * @fileOverview AI-powered input parameter validation for the OptiStack Solver.
 *
 * This file defines a Genkit flow that validates user-provided input parameters
 * (thickness, refractive index, angle of incidence) for the OptiStack Solver.
 * It provides warnings and suggestions if the inputs are outside typical ranges,
 * helping users avoid errors and ensuring physically plausible simulations.
 *
 * @exports validateInputParameters - The main function to validate input parameters.
 * @exports ValidateInputParametersInput - The input type for the validateInputParameters function.
 * @exports ValidateInputParametersOutput - The output type for the validateInputParameters function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';


const ValidateInputParametersInputSchema = z.object({
  numLayers: z.number().describe('The number of layers in the stack.'),
  thickness: z.array(z.number()).describe('An array of layer thicknesses in nanometers.'),
  refractiveIndex: z.array(z.number()).describe('An array of refractive indices for each layer.'),
  angleOfIncidence: z.number().describe('The angle of incidence in degrees.'),
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

  Number of Layers: {{{numLayers}}}
  Thicknesses (nm): {{#each thickness}}{{{this}}} {{/each}}
  Refractive Indices: {{#each refractiveIndex}}{{{this}}} {{/each}}
  Angle of Incidence (degrees): {{{angleOfIncidence}}}
  Polarization: {{{polarization}}}

  Consider typical material properties and physical limitations.
  For example, refractive indices are typically between 1 and 4 for most materials in the visible spectrum.
  Thicknesses should be positive values.
  The angle of incidence should be between 0 and 90 degrees.

  Output warnings and suggestions as needed.
  If everything seems correct, the warnings and suggestions arrays should be empty.
  Do not suggest/recommend changing values that are within appropriate ranges.
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
