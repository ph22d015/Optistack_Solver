
'use client';

import type { SavedSimulationEntry, SolverFormValues, CalculationResults } from '@/types/solver';

const LOCAL_STORAGE_KEY = 'pastSimulations';
const MAX_SAVED_SIMULATIONS = 10;

export function getSavedSimulations(): SavedSimulationEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }
  const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

export function saveSimulation(
  formValues: SolverFormValues,
  results: CalculationResults,
  name?: string
): SavedSimulationEntry {
  if (typeof window === 'undefined') {
    // Should not happen in client-side calls, but good for safety
    const newEntryForReturn: SavedSimulationEntry = {
        id: `sim-${Date.now()}`,
        timestamp: Date.now(),
        name: name || `Simulation @ ${new Date().toLocaleString()}`,
        formValues,
        results,
    };
    console.warn("localStorage not available. Simulation not saved.");
    return newEntryForReturn; 
  }

  const simulations = getSavedSimulations();
  const newEntry: SavedSimulationEntry = {
    id: `sim-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
    name: name || `Simulation @ ${new Date().toLocaleString()}`,
    formValues,
    results,
  };

  simulations.unshift(newEntry); // Add to the beginning

  if (simulations.length > MAX_SAVED_SIMULATIONS) {
    simulations.splice(MAX_SAVED_SIMULATIONS); // Keep only the newest MAX_SAVED_SIMULATIONS
  }

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(simulations));
  return newEntry;
}

export function deleteSimulation(id: string): void {
  if (typeof window === 'undefined') return;
  let simulations = getSavedSimulations();
  simulations = simulations.filter(sim => sim.id !== id);
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(simulations));
}

export function getSimulationById(id: string): SavedSimulationEntry | undefined {
  if (typeof window === 'undefined') return undefined;
  const simulations = getSavedSimulations();
  return simulations.find(sim => sim.id === id);
}
