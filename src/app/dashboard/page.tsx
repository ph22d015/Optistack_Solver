
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { User, BarChartHorizontalBig, TrendingUp, History, Package, Trash2, Edit, Eye } from 'lucide-react';
import Link from 'next/link';
import { getSavedSimulations, deleteSimulation as deleteSimulationFromStorage } from '@/lib/localStorageUtils';
import type { SavedSimulationEntry } from '@/types/solver';
import OpticalChart from '@/components/solver/optical-chart'; // Re-render chart
import StackVisualizer from '@/components/solver/stack-visualizer'; // Re-render stack visualizer
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulationEntry[]>([]);
  const [isLoadingSimulations, setIsLoadingSimulations] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      setIsLoadingSimulations(true);
      setSavedSimulations(getSavedSimulations());
      setIsLoadingSimulations(false);
    }
  }, [user, authLoading, router]);

  const handleDeleteSimulation = (id: string) => {
    deleteSimulationFromStorage(id);
    setSavedSimulations(getSavedSimulations()); // Refresh the list
    toast({
      title: "Simulation Deleted",
      description: "The selected simulation has been removed from your history.",
    });
  };

  const handleReloadAndEdit = (id: string) => {
    router.push(`/solver?loadSimulationId=${id}`);
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="container mx-auto px-4 space-y-8"> {/* Removed py-8 */}
        <Skeleton className="h-10 w-1/3 mb-6" />
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg md:col-span-2" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Redirect will be handled by useEffect
  }

  return (
    <div className="container mx-auto px-4 space-y-8"> {/* Removed py-8 */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl mb-2">
          Dashboard
        </h1>
        <p className="text-lg text-foreground/80">
          Welcome back, {user.displayName || user.email}!
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <User className="h-6 w-6 text-primary/80" />
              User Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><span className="font-semibold">Email:</span> {user.email}</p>
            <p><span className="font-semibold">User ID:</span> {user.uid}</p>
            {/* Add more user details if available and needed */}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Package className="h-6 w-6 text-primary/80" />
              API Quota & Usage
            </CardTitle>
            <CardDescription>
              Information about your API request limits.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              API quota tracking is not currently implemented.
            </p>
            <div className="mt-4 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <History className="h-6 w-6 text-primary/80" />
            Past Simulation Data
          </CardTitle>
          <CardDescription>
            Access your previously run simulations and their results (max 10, stored in browser).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSimulations && (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {!isLoadingSimulations && savedSimulations.length === 0 && (
            <p className="text-muted-foreground text-center py-6">
              No past simulations found. Run and save a simulation from the <Link href="/solver" className="text-primary hover:underline">Solver</Link> page.
            </p>
          )}
          {!isLoadingSimulations && savedSimulations.length > 0 && (
            <div className="space-y-6">
              {savedSimulations.map((sim) => {
                  const incidentMat = sim.formValues.materialLibrary.find(m => m.id === sim.formValues.incidentMediumMaterialId);
                  const substrateMat = sim.formValues.materialLibrary.find(m => m.id === sim.formValues.substrateMediumMaterialId);
                  const internalLayersForVisualizer = Array.from({ length: sim.formValues.numLayers }, (_, i) => {
                    const layerMatId = sim.formValues.layerMaterials[i]?.materialId;
                    const material = sim.formValues.materialLibrary.find(m => m.id === layerMatId);
                    return {
                      materialName: material?.name,
                      thickness: sim.formValues.thickness[i] ?? 0,
                    };
                  });

                return (
                  <Card key={sim.id} className="overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-lg">{sim.name || `Simulation from ${new Date(sim.timestamp).toLocaleDateString()}`}</CardTitle>
                      <CardDescription>
                        {sim.formValues.sweepType === 'wavelength' 
                          ? `Wavelength Sweep: ${sim.formValues.minWavelength}nm to ${sim.formValues.maxWavelength}nm @ ${sim.formValues.angleOfIncidence}°`
                          : `Angle Sweep: ${sim.formValues.minAngle}° to ${sim.formValues.maxAngle}° @ ${sim.formValues.wavelength}nm`}
                        , {sim.formValues.numLayers} layer(s), {sim.formValues.polarization} polarization.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-3 gap-4 items-start">
                        <div className="md:col-span-2">
                           <OpticalChart data={sim.results.data} sweepParameter={sim.results.sweepParameter} />
                        </div>
                        <div className="md:col-span-1">
                           <StackVisualizer
                             incidentMaterialName={incidentMat?.name}
                             substrateMaterialName={substrateMat?.name}
                             internalLayers={internalLayersForVisualizer}
                           />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 bg-muted/50 p-4">
                       <Button variant="outline" size="sm" onClick={() => handleReloadAndEdit(sim.id)}>
                         <Edit className="mr-2 h-4 w-4" /> Reload & Edit
                       </Button>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="sm">
                             <Trash2 className="mr-2 h-4 w-4" /> Delete
                           </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete this saved simulation from your browser.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteSimulation(sim.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
