
'use client';

import type { NamedMaterial } from '@/types/solver';

interface StackLayer {
  name: string;
  thickness?: number; // Optional, as incident/substrate are semi-infinite
  isInternal: boolean;
  colorClass: string;
}

interface StackVisualizerProps {
  incidentMaterialName?: string;
  substrateMaterialName?: string;
  internalLayers: Array<{
    materialName?: string;
    thickness: number;
  }>;
}

const INTERNAL_LAYER_COLORS = [
  'bg-sky-200/70 border-sky-400',
  'bg-amber-200/70 border-amber-400',
  'bg-lime-200/70 border-lime-400',
  'bg-rose-200/70 border-rose-400',
  'bg-violet-200/70 border-violet-400',
  'bg-teal-200/70 border-teal-400',
  'bg-orange-200/70 border-orange-400',
  'bg-emerald-200/70 border-emerald-400',
  'bg-fuchsia-200/70 border-fuchsia-400',
  'bg-cyan-200/70 border-cyan-400',
];

const MEDIA_COLOR = 'bg-slate-200/80 border-slate-400'; // For incident and substrate

export default function StackVisualizer({
  incidentMaterialName,
  substrateMaterialName,
  internalLayers,
}: StackVisualizerProps) {
  const layersToRender: StackLayer[] = [];

  // Incident Medium
  layersToRender.push({
    name: incidentMaterialName || 'Incident Medium (Select)',
    isInternal: false,
    colorClass: MEDIA_COLOR,
  });

  // Internal Layers
  internalLayers.forEach((layer, index) => {
    layersToRender.push({
      name: layer.materialName || `Layer ${index + 1} (Select Material)`,
      thickness: layer.thickness,
      isInternal: true,
      colorClass: INTERNAL_LAYER_COLORS[index % INTERNAL_LAYER_COLORS.length],
    });
  });

  // Substrate Medium
  layersToRender.push({
    name: substrateMaterialName || 'Substrate (Select)',
    isInternal: false,
    colorClass: MEDIA_COLOR,
  });

  const getLayerHeight = (layer: StackLayer) => {
    if (!layer.isInternal) {
      return 'h-16'; // Fixed height for incident/substrate
    }
    // Basic scaling for internal layers, with min/max to keep it reasonable
    const scaledHeight = Math.max(20, Math.min(100, (layer.thickness || 0) * 0.2 + 20));
    return `h-[${Math.round(scaledHeight)}px]`; // Use Tailwind JIT arbitrary values
  };

  return (
    <div className="w-full max-w-xs mx-auto my-4 p-4 border rounded-lg shadow-md bg-card">
      <h4 className="text-sm font-semibold text-center mb-3 text-primary">Optical Stack Preview</h4>
      <div className="flex flex-col items-stretch">
        {layersToRender.map((layer, index) => (
          <div
            key={index}
            className={`flex flex-col items-center justify-center p-2 border-b last:border-b-0 text-xs text-center transition-all duration-300 ease-in-out ${layer.colorClass} ${getLayerHeight(layer)}`}
            aria-label={`Layer ${index}: ${layer.name}${layer.isInternal ? `, Thickness: ${layer.thickness}nm` : ''}`}
          >
            <span className="font-medium text-foreground/90">{layer.name}</span>
            {layer.isInternal && typeof layer.thickness === 'number' && (
              <span className="text-foreground/70">{layer.thickness} nm</span>
            )}
            {!layer.isInternal && index === 0 && (
                 <span className="text-xs text-foreground/60">(Light Incident From Here)</span>
            )}
          </div>
        ))}
      </div>
       <p className="text-xs text-muted-foreground mt-3 text-center">
        Note: Layer heights are illustrative, not to scale for semi-infinite media or extreme thickness variations.
      </p>
    </div>
  );
}
