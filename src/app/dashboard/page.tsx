
'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { User, BarChartHorizontalBig, TrendingUp, History, Package } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
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
    <div className="container mx-auto px-4 py-8 space-y-8">
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
              API quota tracking is not currently implemented in this demo. In a production application, this section would display your current usage against your allocated quota for simulation calculations.
            </p>
            {/* Placeholder for quota bar or stats */}
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
            Access your previously run simulations and their results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Storing and retrieving past simulation data is not currently implemented. This feature would allow you to revisit and compare results from previous calculations.
          </p>
          {/* Placeholder for a list or table of past simulations */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-md">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-8 w-24" />
            </div>
             <div className="flex items-center justify-between p-3 border rounded-md">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
