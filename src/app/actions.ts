
// src/app/actions.ts
'use server';

import { validateInputParameters as validateInputParamsFlow, ValidateInputParametersInput } from '@/ai/flows/validate-input-parameters';
import type { AiFeedback, SolverFormValues } from '@/types/solver';

// This function now takes a structure matching SolverFormValues
export async function performAiValidation(data: SolverFormValues): Promise<AiFeedback> {
  try {
    // Construct the input for the AI flow, ensuring all values are numbers
    // The schema in the AI flow handles optionality based on sweepType for validation logic.
    const aiInput: ValidateInputParametersInput = {
      sweepType: data.sweepType,
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
      polarization: data.polarization,

      // Wavelength sweep specific (pass them anyway, AI prompt will use based on sweepType)
      minWavelength: data.minWavelength !== undefined ? Number(data.minWavelength) : undefined,
      maxWavelength: data.maxWavelength !== undefined ? Number(data.maxWavelength) : undefined,
      angleOfIncidence: data.angleOfIncidence !== undefined ? Number(data.angleOfIncidence) : undefined,

      // Angle sweep specific (pass them anyway, AI prompt will use based on sweepType)
      wavelength: data.wavelength !== undefined ? Number(data.wavelength) : undefined,
      minAngle: data.minAngle !== undefined ? Number(data.minAngle) : undefined,
      maxAngle: data.maxAngle !== undefined ? Number(data.maxAngle) : undefined,
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
