
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Layers, Library, ArrowDownUp, Repeat, Sigma, ScanLine, GitCommitHorizontal, Waves, Calculator, BarChart3, Download, UploadCloud, Eye, BookType } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-12">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          Optical Solver Help Guide
        </h1>
        <p className="mt-4 text-xl text-foreground/80 leading-relaxed">
          A step-by-step guide to simulating multilayer optical stacks.
        </p>
      </header>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Introduction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-foreground/90 leading-relaxed">
          <p>
            Welcome to the OptiStack Solver! This tool allows you to simulate the optical response (reflectance, transmittance, and absorptance) of multilayer thin-film stacks. Follow the steps below to set up your simulation.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Library className="h-6 w-6 text-primary/80" /> Step 1: Define Your Materials (Material Library)</CardTitle>
          <CardDescription>
            All materials used in your stack (including surrounding media) must first be defined in the Material Library.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-foreground/90 leading-relaxed">
          <section>
            <h3 className="text-xl font-semibold mb-2 text-primary/90">1.1 Adding a New Material</h3>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Click the "Add Material" button in the "Material Library" section.</li>
              <li>A new material entry will appear.</li>
            </ul>
          </section>
          <section>
            <h3 className="text-xl font-semibold mb-2 text-primary/90">1.2 Naming Your Material</h3>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Enter a unique "Material Name" (e.g., "Silicon", "Air", "SiO2 Film").</li>
            </ul>
          </section>
          <section>
            <h3 className="text-xl font-semibold mb-2 text-primary/90">1.3 Setting Material Properties</h3>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>
                Choose the "Material Property Type":
                <ul className="list-circle list-inside space-y-1 pl-6 mt-1">
                  <li>
                    <strong>Constant n & k:</strong> For materials where the refractive index (n) and extinction coefficient (k) are constant over your wavelength range of interest. Enter the 'n' and 'k' values directly.
                  </li>
                  <li>
                    <strong>Dispersive (Wavelength Dependent):</strong> For materials where n and k vary with wavelength.
                    <ul className="list-disc list-inside space-y-1 pl-6 mt-1">
                      <li>Optionally, provide a "Descriptive Name (Optional)" (e.g., "Gold - Palik data").</li>
                      <li>
                        You can either <strong className="text-primary/90">Upload File</strong> (a <code>.txt</code> or <code>.csv</code> file with three columns: wavelength (nm), n, k) or manually input data if you have very few points (by clicking "Clear & Edit Manually" if a file was previously loaded).
                      </li>
                      <li>If you upload a file or have more than 2 data points, you will see a summary and an <Eye className="inline h-4 w-4" /> "Plot Data" button to visualize the n and k curves.</li>
                      <li>The "Clear & Edit Manually" button resets the data to two default points, allowing direct input.</li>
                    </ul>
                  </li>
                </ul>
              </li>
              <li>You can add multiple materials to your library. "Air" (n=1, k=0) is provided by default.</li>
            </ul>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><ArrowDownUp className="h-6 w-6 text-primary/80" /> Step 2: Define Surrounding Media</CardTitle>
          <CardDescription>
            Specify the materials for the medium from which light is incident and the substrate medium.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-foreground/90 leading-relaxed">
          <ul className="list-disc list-inside space-y-2 pl-4">
            <li>In the "Surrounding Media" section, use the dropdown menus for "Incident Medium (Top)" and "Substrate Medium (Bottom)".</li>
            <li>Select materials that you have defined in your Material Library. Typically, the incident medium is "Air".</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Repeat className="h-6 w-6 text-primary/80" /> Step 3: Choose Calculation Sweep Type</CardTitle>
          <CardDescription>
            Decide whether you want to simulate the optical response as a function of wavelength or angle of incidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-foreground/90 leading-relaxed">
          <ul className="list-disc list-inside space-y-2 pl-4">
            <li>Use the "Calculation Sweep Type" dropdown to select either "Sweep Wavelength (fixed angle)" or "Sweep Angle (fixed wavelength)".</li>
          </ul>
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Sigma className="h-6 w-6 text-primary/80" /> Step 4: Set Sweep-Specific Parameters</CardTitle>
           <CardDescription>
            Based on your choice in Step 3, provide the necessary parameters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-foreground/90 leading-relaxed">
          <section>
            <h3 className="text-xl font-semibold mb-2 text-primary/90">4.1 If "Sweep Wavelength" is selected:</h3>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>
                <ScanLine className="inline h-5 w-5 mr-1" /> <strong>Min Wavelength (nm) & Max Wavelength (nm):</strong> Define the range of wavelengths for the simulation (e.g., 400 nm to 700 nm).
              </li>
              <li>
                <GitCommitHorizontal className="inline h-5 w-5 mr-1" /> <strong>Fixed Angle of Incidence (°):</strong> Enter the constant angle at which light will strike the stack (e.g., 0° for normal incidence).
              </li>
            </ul>
          </section>
           <Separator className="my-4"/>
          <section>
            <h3 className="text-xl font-semibold mb-2 text-primary/90">4.2 If "Sweep Angle" is selected:</h3>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>
                <ScanLine className="inline h-5 w-5 mr-1" /> <strong>Fixed Wavelength (nm):</strong> Enter the single wavelength at which the simulation will be performed (e.g., 550 nm).
              </li>
              <li>
                 <GitCommitHorizontal className="inline h-5 w-5 mr-1" /> <strong>Min Angle of Incidence (°) & Max Angle of Incidence (°):</strong> Define the range of incident angles (e.g., 0° to 89.9°).
              </li>
            </ul>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Layers className="h-6 w-6 text-primary/80" /> Step 5: Define the Multilayer Stack</CardTitle>
          <CardDescription>
            Specify the number of internal layers, their thicknesses, and their materials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-foreground/90 leading-relaxed">
          <section>
            <h3 className="text-xl font-semibold mb-2 text-primary/90">5.1 Number of Internal Layers</h3>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Enter the "Number of Internal Layers" (e.g., 0 for a simple interface between incident and substrate, 1 for a single film, etc.). Max 20 layers.</li>
              <li>The form will dynamically update to show input fields for each layer.</li>
            </ul>
          </section>
          <section>
            <h3 className="text-xl font-semibold mb-2 text-primary/90">5.2 Layer Details (for each layer)</h3>
             <p className="mb-2 text-sm text-muted-foreground">These are the layers sandwiched between your chosen Incident and Substrate media.</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>
                <strong className="text-primary/90">Thickness (nm):</strong> Enter the thickness of the layer in nanometers.
              </li>
              <li>
                <strong className="text-primary/90">Material:</strong> Select a material for this layer from the dropdown. The materials available are those you defined in your Material Library (Step 1).
              </li>
            </ul>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Waves className="h-6 w-6 text-primary/80" /> Step 6: Set Polarization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-foreground/90 leading-relaxed">
          <ul className="list-disc list-inside space-y-2 pl-4">
            <li>Choose the "Polarization" of the incident light:
              <ul className="list-circle list-inside space-y-1 pl-6 mt-1">
                <li><strong>TE (s-pol):</strong> Transverse Electric polarization.</li>
                <li><strong>TM (p-pol):</strong> Transverse Magnetic polarization.</li>
              </ul>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Calculator className="h-6 w-6 text-primary/80" /> Step 7: Calculate</CardTitle>
           <CardDescription>
            Once all parameters are set, you can run the simulation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-foreground/90 leading-relaxed">
          <ul className="list-disc list-inside space-y-2 pl-4">
            <li>If reCAPTCHA is enabled, complete the "I'm not a robot" challenge.</li>
            <li>Click the "Calculate Optical Response" button.</li>
            <li>The simulation will run, and the results will be displayed below.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary/80" /> Step 8: View Results</CardTitle>
          <CardDescription>
            The calculated Reflectance (R), Transmittance (T), and Absorptance (A) will be plotted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-foreground/90 leading-relaxed">
          <ul className="list-disc list-inside space-y-2 pl-4">
            <li>The plot will show R, T, and A as a function of either wavelength or angle, depending on your sweep type.</li>
            <li>Hover over the curves to see specific values at each point.</li>
            <li>
              <Download className="inline h-5 w-5 mr-1" /> Click the "Download Data (CSV)" button to save the raw simulation data.
            </li>
          </ul>
        </CardContent>
      </Card>

      <footer className="text-center text-muted-foreground text-sm py-8">
        <p>If you encounter any issues or have questions not covered here, please refer to the Documentation or Contact support.</p>
      </footer>
    </div>
  );
}

    