
// src/app/actions.ts
'use server';

import { validateInputParameters as validateInputParamsFlow, ValidateInputParametersInput } from '@/ai/flows/validate-input-parameters';
import type { AiFeedback, ComplexRefractiveIndexSchema as ComplexRI } from '@/types/solver'; // Renamed for clarity

// This function now takes a structure matching ValidateInputParametersInput
export async function performAiValidation(data: {
  incidentMediumRefractiveIndex: { n: number; k: number };
  substrateMediumRefractiveIndex: { n: number; k: number };
  numLayers: number;
  thickness: number[];
  refractiveIndex: { n: number; k: number }[];
  angleOfIncidence: number;
  polarization: 'TE' | 'TM';
  minWavelength: number;
  maxWavelength: number;
}): Promise<AiFeedback> {
  try {
    // Construct the input for the AI flow, ensuring all values are numbers
    const aiInput: ValidateInputParametersInput = {
      incidentMediumRefractiveIndex: {
        n: Number(data.incidentMediumRefractiveIndex.n),
        k: Number(data.incidentMediumRefractiveIndex.k),
      },
      substrateMediumRefractiveIndex: {
        n: Number(data.substrateMediumRefractiveIndex.n),
        k: Number(data.substrateMediumRefractiveIndex.k),
      },
      numLayers: Number(data.numLayers),
      thickness: data.thickness.map(t => Number(t)),
      refractiveIndex: data.refractiveIndex.map(ri => ({
        n: Number(ri.n),
        k: Number(ri.k),
      })),
      angleOfIncidence: Number(data.angleOfIncidence),
      polarization: data.polarization,
      minWavelength: Number(data.minWavelength),
      maxWavelength: Number(data.maxWavelength),
    };

    console.log("Performing AI Validation with input:", aiInput);
    const result = await validateInputParamsFlow(aiInput);
    console.log("AI Validation result:", result);
    return result;
  } catch (error) {
    console.error("AI Validation Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during AI validation.";
    return { warnings: [`Error: ${errorMessage}`], suggestions: [] };
  }
}

