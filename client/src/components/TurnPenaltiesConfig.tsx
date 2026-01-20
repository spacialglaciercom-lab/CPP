/**
 * Turn Penalties Configuration Component
 * Design: Command Center Interface
 * - Sliders for configuring turn penalties
 * - Real-time value display
 * - Warning callout for Mode A
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ChevronDown, ChevronUp, RotateCcw, Sliders } from "lucide-react";
import { useTurnPenalties, DEFAULT_PENALTIES } from "@/contexts/TurnPenaltiesContext";

export default function TurnPenaltiesConfig() {
  const { penalties, updatePenalty, resetToDefaults } = useTurnPenalties();
  const [isExpanded, setIsExpanded] = useState(false);

  const sliderConfigs = [
    {
      key: "straight" as const,
      label: "Straight Ahead",
      min: 0,
      max: 100,
      step: 1,
      description: "Penalty for continuing straight",
      color: "bg-blue-500/20 border-blue-500/50",
    },
    {
      key: "rightTurn" as const,
      label: "Right Turns",
      min: 0,
      max: 200,
      step: 5,
      description: "Penalty for right turns (recommended: 10-50)",
      color: "bg-emerald-500/20 border-emerald-500/50",
    },
    {
      key: "leftTurn" as const,
      label: "Left Turns",
      min: 0,
      max: 500,
      step: 10,
      description: "Penalty for left turns (recommended: 50-150)",
      color: "bg-amber-500/20 border-amber-500/50",
    },
    {
      key: "uTurn" as const,
      label: "U-Turns",
      min: 0,
      max: 1000,
      step: 50,
      description: "Penalty for U-turns (recommended: 300-800)",
      color: "bg-red-500/20 border-red-500/50",
    },
  ];

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1 text-left"
          >
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              Turn Penalties Configuration
            </CardTitle>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Fine-tune how the algorithm prioritizes different turn types
        </p>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Sliders */}
          {sliderConfigs.map((config) => (
            <div key={config.key} className={`rounded-lg p-3 border ${config.color}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-foreground">
                  {config.label}
                </label>
                <span className="font-mono text-sm text-primary">
                  {penalties[config.key]}
                </span>
              </div>

              <Slider
                value={[penalties[config.key]]}
                onValueChange={(value) => updatePenalty(config.key, value[0])}
                min={config.min}
                max={config.max}
                step={config.step}
                className="mb-2"
              />

              <p className="text-[10px] text-muted-foreground/70">
                {config.description}
              </p>
            </div>
          ))}

          {/* Reset Button */}
          <Button
            onClick={resetToDefaults}
            variant="outline"
            className="w-full border-border/50 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3 h-3 mr-2" />
            Reset to Defaults
          </Button>

          {/* Warning Callout */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-red-400">
                  Mode A Warning
                </p>
                <p className="text-[10px] text-red-400/80">
                  Mode A ignores one-way street restrictions. This may result in illegal driving maneuvers. Use only in controlled environments or for planning purposes.
                </p>
              </div>
            </div>
          </div>

          {/* Info Badge */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/50 text-primary text-[10px]"
            >
              Lower values = preferred
            </Badge>
            <Badge
              variant="outline"
              className="border-muted/50 text-muted-foreground text-[10px]"
            >
              Higher values = avoided
            </Badge>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
