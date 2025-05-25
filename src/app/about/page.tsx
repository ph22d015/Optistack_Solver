
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Lightbulb, Layers3 } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-12">
      <header className="text-center">
        <Layers3 className="mx-auto h-16 w-16 text-primary mb-4" />
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          About OptiStack Solver
        </h1>
        <p className="mt-4 text-xl text-foreground/80 leading-relaxed">
          Understanding the capabilities and limitations of this optical simulation tool.
        </p>
      </header>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">What is OptiStack Solver?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-foreground/90 leading-relaxed">
          <p>
            The OptiStack Solver is a web-based application designed to simulate the optical response
            (reflectance, transmittance, and absorptance) of multilayer thin-film stacks. It utilizes
            the Transfer Matrix Method (TMM), a well-established algorithm in optics, to perform these
            calculations based on user-defined parameters such as layer thicknesses, complex refractive
            indices (including dispersion), angle of incidence, and polarization of light.
          </p>
          <p>
            This tool aims to provide an accessible platform for students, researchers, and engineers
            to quickly model and visualize how light interacts with various optical coatings and structures.
            Whether you're designing anti-reflection coatings, dielectric mirrors, optical filters, or
            simply exploring the principles of thin-film optics, OptiStack Solver offers a convenient
            way to get immediate feedback on your designs.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <CheckCircle className="h-7 w-7 text-green-600" />
              Pros / Advantages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-foreground/90 leading-relaxed">
            <ul className="list-disc list-inside space-y-3">
              <li>
                <strong>Accessibility:</strong> Being web-based, it's easily accessible from any device
                with a modern browser without needing to install specialized software.
              </li>
              <li>
                <strong>User-Friendly Interface:</strong> Designed with a clear and interactive UI to
                simplify the input of complex parameters and visualization of results.
              </li>
              <li>
                <strong>Speed:</strong> Provides relatively fast calculations for common stack configurations,
                allowing for rapid iteration and design exploration.
              </li>
              <li>
                <strong>Core Physics:</strong> Implements the standard Transfer Matrix Method, which is
                accurate for coherent light interaction with planar, isotropic, and homogeneous layers.
              </li>
              <li>
                <strong>Material Flexibility:</strong> Supports both constant refractive indices and
                wavelength-dependent (dispersive) materials via user-uploaded data.
              </li>
              <li>
                <strong>Sweep Capabilities:</strong> Allows simulations over a range of wavelengths (at a fixed angle)
                or a range of angles (at a fixed wavelength), offering comprehensive analysis.
              </li>
               <li>
                <strong>Educational Tool:</strong> Can serve as an excellent learning aid for understanding
                thin-film optics principles and the impact of various parameters.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <XCircle className="h-7 w-7 text-red-600" />
              Cons / Limitations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-foreground/90 leading-relaxed">
            <ul className="list-disc list-inside space-y-3">
              <li>
                <strong>Simplified Model:</strong> The TMM assumes ideal conditions:
                <ul className="list-circle list-inside pl-6 space-y-1 mt-1">
                    <li>Perfectly flat and parallel interfaces.</li>
                    <li>Homogeneous and isotropic layer materials.</li>
                    <li>Coherent light interaction (no consideration for incoherence or scattering effects).</li>
                </ul>
              </li>
              <li>
                <strong>No Advanced Effects:</strong> Does not currently model more complex phenomena like
                anisotropy, birefringence, surface roughness, non-linear optics, or quantum effects.
              </li>
              <li>
                <strong>Material Data Input:</strong> While supporting dispersive data, users must manually
                input or upload this data. There's no integrated material database lookup (e.g., from refractiveindex.info).
              </li>
              <li>
                <strong>Computational Limits:</strong> While generally fast, very large numbers of layers or extremely
                fine wavelength/angle steps might lead to longer computation times or browser performance considerations.
                The current limit is set to 20 internal layers.
              </li>
              <li>
                <strong>No Optimization Engine:</strong> This is a solver, not an optimizer. It calculates the response for
                given parameters but doesn't automatically find parameters to achieve a target response.
              </li>
              <li>
                <strong>Limited Error Handling for Extreme Physics:</strong> While efforts are made to handle numerical
                instabilities (e.g., near critical angles), extreme input parameters or material properties might still lead
                to unexpected or non-physical results if they push the boundaries of the TMM assumptions.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-primary/5 border-primary/30">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2 text-primary/90">
            <Lightbulb className="h-6 w-6" />
            Future Considerations
          </CardTitle>
        </CardHeader>
        <CardContent className="text-foreground/80 leading-relaxed">
          <p>
            Potential future enhancements could include a more integrated material database, basic optimization routines,
            or support for modeling incoherent layers. However, the current version focuses on providing a solid foundation
            for standard multilayer optical analysis.
          </p>
        </CardContent>
      </Card>

      <footer className="text-center text-muted-foreground text-sm py-8">
        <p>We hope OptiStack Solver is a valuable tool for your optical design and analysis needs!</p>
      </footer>
    </div>
  );
}
