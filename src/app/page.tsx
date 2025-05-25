
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { Lightbulb, BarChart3, Layers, ShieldCheck, LogIn, PlayCircle } from 'lucide-react'; // Added icons

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const handleGetStarted = () => {
    if (authLoading) return; // Wait for auth state to load
    if (user) {
      router.push('/solver');
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="space-y-12 container mx-auto px-4"> {/* Removed py-8 */}
      <section aria-labelledby="hero-title" className="text-center py-12 bg-gradient-to-br from-primary/10 via-background to-background rounded-lg shadow-lg">
        <h1 id="hero-title" className="text-4xl font-bold tracking-tight text-primary sm:text-5xl lg:text-6xl">
          Welcome to OptiStack Solver
        </h1>
        <p className="mt-6 text-lg leading-8 text-foreground/80 max-w-2xl mx-auto">
          Simulate and analyze the optical response of multilayer thin-film stacks with precision. Explore reflectance, transmittance, and absorptance across wavelengths or angles.
        </p>
        <div className="relative aspect-[2/1] w-full max-w-4xl mx-auto rounded-lg overflow-hidden shadow-xl my-8">
          <Image
            src="/optical_stack_diagram.png"
            alt="Optical layers diagram"
            layout="fill"
            objectFit="contain"
            priority
          />
        </div>
        <Button size="lg" className="mt-10" onClick={handleGetStarted} disabled={authLoading}>
           {authLoading ? 'Loading...' : (user ? <><PlayCircle className="mr-2 h-5 w-5" /> Go to Solver</> : <><LogIn className="mr-2 h-5 w-5" /> Login to Simulate</>)}
        </Button>
      </section>

      <Separator />

      <section aria-labelledby="features-title" className="py-10">
        <h2 id="features-title" className="text-3xl font-bold tracking-tight text-primary text-center mb-10">
          Key Features
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Layers className="h-7 w-7 text-accent" />Multilayer Simulation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/90">Define complex stacks with up to 20 layers, specifying thickness and material properties for each.</p>
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><BarChart3 className="h-7 w-7 text-accent" />Comprehensive Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/90">Calculate Reflectance (R), Transmittance (T), and Absorptance (A) as functions of wavelength or angle of incidence.</p>
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Lightbulb className="h-7 w-7 text-accent" />Dispersive Materials</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/90">Incorporate wavelength-dependent refractive indices (n & k) by defining materials with constant properties or by uploading custom dispersion data.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      <section aria-labelledby="example-plots-title" className="py-10">
        <h2 id="example-plots-title" className="text-3xl font-bold tracking-tight text-primary text-center mb-10">
          Example Simulations
        </h2>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-primary/90">Anti-Reflection Coating</h3>
            <p className="text-foreground/80">
              Visualize how a single layer of MgF₂ on glass can significantly reduce reflections at a target wavelength, enhancing light transmission.
            </p>
             <Image
                src="https://placehold.co/600x300.png?text=Anti-Reflection+Coating+Plot"
                alt="Example plot of an anti-reflection coating"
                width={600}
                height={300}
                className="rounded-lg shadow-md mt-4"
                data-ai-hint="optics anti-reflection"
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-primary/90">Dielectric Mirror</h3>
            <p className="text-foreground/80">
              See the high reflectance band created by a stack of alternating high and low refractive index materials, forming a Bragg reflector.
            </p>
            <Image
                src="https://placehold.co/600x300.png?text=Dielectric+Mirror+Plot"
                alt="Example plot of a dielectric mirror"
                width={600}
                height={300}
                className="rounded-lg shadow-md mt-4"
                data-ai-hint="optics dielectric mirror"
            />
          </div>
        </div>
      </section>

      <Separator />

      <section aria-labelledby="security-notice-title" className="text-center py-10">
         <ShieldCheck className="mx-auto h-12 w-12 text-primary mb-4" />
        <h2 id="security-notice-title" className="text-2xl font-semibold text-primary mb-3">
          Secure and Reliable
        </h2>
        <p className="text-foreground/80 max-w-xl mx-auto">
          Your simulations are protected. Login is required to access the solver, and we utilize reCAPTCHA to prevent abuse and ensure fair usage of resources.
        </p>
      </section>
    </div>
  );
}
