import type { SolverFormValues, OpticalResponsePoint } from '@/types/solver';

// Mock calculation function
export async function calculateOpticalResponse(
  params: SolverFormValues
): Promise<OpticalResponsePoint[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const data: OpticalResponsePoint[] = [];
      const numPoints = 100; // Number of wavelength points
      const minWavelength = 400; // nm
      const maxWavelength = 700; // nm

      for (let i = 0; i < numPoints; i++) {
        const wavelength = minWavelength + (i * (maxWavelength - minWavelength)) / (numPoints - 1);
        
        // Simple mock data based on number of layers and angle
        // This is NOT a real optical calculation
        const baseReflectance = 0.1 + (params.numLayers * 0.05) + (params.angleOfIncidence / 900);
        const reflectance = baseReflectance + 0.05 * Math.sin((wavelength - minWavelength) / 50 + params.numLayers) * Math.cos(params.angleOfIncidence / 10);
        const clampedReflectance = Math.max(0, Math.min(1, reflectance));
        
        const transmittance = 0.9 - baseReflectance - 0.05 * Math.cos((wavelength - minWavelength) / 40 + params.numLayers) * Math.sin(params.angleOfIncidence / 15);
        const clampedTransmittance = Math.max(0, Math.min(1 - clampedReflectance, transmittance));

        data.push({
          wavelength,
          reflectance: clampedReflectance,
          transmittance: clampedTransmittance,
        });
      }
      resolve(data);
    }, 1500); // Simulate network delay
  });
}
