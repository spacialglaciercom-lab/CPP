/**
 * U-Turn Detection Panel Component
 * Displays U-turn restrictions and turning features from OSM analysis
 * Design: Command Center Interface
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronDown,
  ChevronUp,
  Download,
  AlertCircle,
  CheckCircle2,
  Navigation,
  MapPin,
} from "lucide-react";
import {
  UTurnDetectionResult,
  exportUTurnDetectionJSON,
  exportUTurnDetectionCSV,
} from "@/lib/uTurnDetector";

interface UTurnDetectionPanelProps {
  result: UTurnDetectionResult;
}

export default function UTurnDetectionPanel({ result }: UTurnDetectionPanelProps) {
  const [expandedRestrictions, setExpandedRestrictions] = useState<Set<string>>(
    new Set()
  );
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(
    new Set()
  );

  const toggleRestriction = (id: string) => {
    const newSet = new Set(expandedRestrictions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRestrictions(newSet);
  };

  const toggleFeature = (id: string) => {
    const newSet = new Set(expandedFeatures);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedFeatures(newSet);
  };

  const handleExportJSON = () => {
    const json = exportUTurnDetectionJSON(result);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "uturn_detection.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const csv = exportUTurnDetectionCSV(result);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "uturn_detection.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          U-Turn Detection Analysis
        </CardTitle>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Identified restrictions and turning features in the OSM data
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-[10px] text-red-400/70 uppercase tracking-wider">
              No U-Turn
            </p>
            <p className="text-lg font-display text-red-400">
              {result.summary.noUTurnCount}
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
            <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider">
              Allow U-Turn
            </p>
            <p className="text-lg font-display text-emerald-400">
              {result.summary.allowUTurnCount}
            </p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-[10px] text-blue-400/70 uppercase tracking-wider">
              Turning Circles
            </p>
            <p className="text-lg font-display text-blue-400">
              {result.summary.turningCircleCount}
            </p>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
            <p className="text-[10px] text-cyan-400/70 uppercase tracking-wider">
              Turning Loops
            </p>
            <p className="text-lg font-display text-cyan-400">
              {result.summary.turningLoopCount}
            </p>
          </div>
        </div>

        {/* Tabs for Restrictions and Features */}
        <Tabs defaultValue="restrictions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-background/50">
            <TabsTrigger value="restrictions" className="text-xs">
              Restrictions ({result.restrictions.length})
            </TabsTrigger>
            <TabsTrigger value="features" className="text-xs">
              Turning Features ({result.turningFeatures.length})
            </TabsTrigger>
          </TabsList>

          {/* Restrictions Tab */}
          <TabsContent value="restrictions" className="space-y-2 mt-3">
            {result.restrictions.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 text-center py-4">
                No U-turn restrictions found
              </p>
            ) : (
              <ScrollArea className="h-64 rounded-lg border border-border/30 bg-background/30 p-2">
                <div className="space-y-2">
                  {result.restrictions.map((restriction) => (
                    <div
                      key={restriction.id}
                      className="border border-border/30 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleRestriction(restriction.id)}
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-background/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {restriction.type === "no_u_turn" ? (
                            <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">
                              {restriction.streetNames.join(", ") || `Relation ${restriction.id}`}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70">
                              ID: {restriction.id}
                            </p>
                          </div>
                        </div>
                        {expandedRestrictions.has(restriction.id) ? (
                          <ChevronUp className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </button>

                      {expandedRestrictions.has(restriction.id) && (
                        <div className="px-3 py-2 bg-background/50 border-t border-border/30 space-y-2 text-xs">
                          <div>
                            <p className="text-muted-foreground/70">Type:</p>
                            <Badge
                              variant="outline"
                              className={
                                restriction.type === "no_u_turn"
                                  ? "border-red-500/50 text-red-400"
                                  : "border-emerald-500/50 text-emerald-400"
                              }
                            >
                              {restriction.type}
                            </Badge>
                          </div>
                          {restriction.streetNames.length > 0 && (
                            <div>
                              <p className="text-muted-foreground/70">Streets:</p>
                              <p className="text-foreground/80">
                                {restriction.streetNames.join(", ")}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-muted-foreground/70">
                              Nodes: {restriction.nodeReferences.length}
                            </p>
                          </div>
                          {restriction.coordinates.length > 0 && (
                            <div>
                              <p className="text-muted-foreground/70">
                                Sample Coordinates:
                              </p>
                              <p className="text-foreground/80 font-mono text-[9px]">
                                {restriction.coordinates[0].lat.toFixed(6)},
                                {restriction.coordinates[0].lon.toFixed(6)}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-2 mt-3">
            {result.turningFeatures.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 text-center py-4">
                No turning circles or loops found
              </p>
            ) : (
              <ScrollArea className="h-64 rounded-lg border border-border/30 bg-background/30 p-2">
                <div className="space-y-2">
                  {result.turningFeatures.map((feature) => (
                    <div
                      key={feature.id}
                      className="border border-border/30 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleFeature(feature.id)}
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-background/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Navigation className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">
                              {feature.name || `${feature.type} ${feature.id}`}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70">
                              ID: {feature.id}
                            </p>
                          </div>
                        </div>
                        {expandedFeatures.has(feature.id) ? (
                          <ChevronUp className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </button>

                      {expandedFeatures.has(feature.id) && (
                        <div className="px-3 py-2 bg-background/50 border-t border-border/30 space-y-2 text-xs">
                          <div>
                            <p className="text-muted-foreground/70">Type:</p>
                            <Badge
                              variant="outline"
                              className="border-cyan-500/50 text-cyan-400"
                            >
                              {feature.type}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-muted-foreground/70">
                              Nodes: {feature.nodeReferences.length}
                            </p>
                          </div>
                          {feature.coordinates.length > 0 && (
                            <div>
                              <p className="text-muted-foreground/70">
                                Center Coordinates:
                              </p>
                              <p className="text-foreground/80 font-mono text-[9px]">
                                {feature.coordinates[0].lat.toFixed(6)},
                                {feature.coordinates[0].lon.toFixed(6)}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {/* Export Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleExportJSON}
            variant="outline"
            size="sm"
            className="flex-1 border-border/50 text-muted-foreground hover:text-foreground text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            JSON
          </Button>
          <Button
            onClick={handleExportCSV}
            variant="outline"
            size="sm"
            className="flex-1 border-border/50 text-muted-foreground hover:text-foreground text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
