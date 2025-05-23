// src/app/actions.ts
'use server';

import { validateInputParameters as validateInputParamsFlow, ValidateInputParametersInput, ValidateInputParametersOutput } from '@/ai/flows/validate-input-parameters';
import type { AiFeedback } from '@/types/solver';

export async function performAiValidation(input: ValidateInputParametersInput): Promise<AiFeedback> {
  try {
    console.log("Performing AI Validation with input:", input);
    const result = await validateInputParamsFlow(input);
    console.log("AI Validation result:", result);
    return result;
  } catch (error) {
    console.error("AI Validation Error:", error);
    // Ensure the error is serializable if it's passed to the client
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during AI validation.";
    return { warnings: [`Error: ${errorMessage}`], suggestions: [] };
  }
}
