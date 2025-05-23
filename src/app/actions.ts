// src/app/actions.ts
'use server';

import { validateInputParameters as validateInputParamsFlow, ValidateInputParametersInput } from '@/ai/flows/validate-input-parameters';
import type { AiFeedback, SolverFormValues } from '@/types/solver';

// This function now takes a subset of SolverFormValues matching ValidateInputParametersInput
// to make the mapping more explicit here.
export async function performAiValidation(data: {
  numLayers: number;
  thickness: number[];
  refractiveIndex: { n: number; k: number }[];
  angleOfIncidence: number;
  polarization: 'TE' | 'TM';
  minWavelength: number;
  maxWavelength: number;
}): Promise<AiFeedback> {
  try {
    // Construct the input for the AI flow
    const aiInput: ValidateInputParametersInput = {
      numLayers: data.numLayers,
      thickness: data.thickness.map(t => Number(t)), // Ensure numbers
      refractiveIndex: data.refractiveIndex.map(ri => ({
        n: Number(ri.n), // Ensure numbers
        k: Number(ri.k), // Ensure numbers
      })),
      angleOfIncidence: Number(data.angleOfIncidence), // Ensure number
      polarization: data.polarization,
      minWavelength: Number(data.minWavelength), // Ensure number
      maxWavelength: Number(data.maxWavelength), // Ensure number
    };

    console.log("Performing AI Validation with input:", aiInput);
    const result = await validateInputParamsFlow(aiInput);
    console.log("AI Validation result:", result);
    return result;
  } catch (error) {
    console.error("AI Validation Error:", error);
    // Ensure the error is serializable if it's passed to the client
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during AI validation.";
    return { warnings: [`Error: ${errorMessage}`], suggestions: [] };
  }
}
