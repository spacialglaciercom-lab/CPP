/**
 * Trash Collection Route Planner - Home Page
 * Design: Command Center Interface
 * - Dark theme with electric cyan accents
 * - Three-column layout: sidebar | map | data panel
 * - Terminal-style processing logs
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Upload,
  MapPin,
  Route,
  Download,
  Clock,
  Ruler,
  GitBranch,
  FileText,
  Terminal,
  Crosshair,
  Truck,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
} from "lucide-react";
import {
  processRoute,
  ProcessingLog,
  RouteResult,
  StartPoint,
  TurnPenaltyConfig,
} from "@/lib/routeProcessor";
import { useTurnPenalties } from "@/contexts/TurnPenaltiesContext";
import { detectUTurns, UTurnDetectionResult } from "@/lib/uTurnDetector";
import RouteMap from "@/components/RouteMap";
import LeafletMap from "@/components/LeafletMap";
import AnimatedLeafletMap from "@/components/AnimatedLeafletMap";
import TurnPenaltiesConfig from "@/components/TurnPenaltiesConfig";
import UTurnDetectionPanel from "@/components/UTurnDetectionPanel";
import ConsolePanel from "@/components/ConsolePanel";

export default function Home() {
  // Get turn penalties from context
  const { penalties } = useTurnPenalties();

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuration state
  const [filename, setFilename] = useState("trash_route");
  const [ignoreOneways, setIgnoreOneways] = useState(true);
  const [useCustomStart, setUseCustomStart] = useState(false);
  const [startLat, setStartLat] = useState("");
  const [startLon, setStartLon] = useState("");

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [uTurnDetection, setUTurnDetection] = useState<UTurnDetectionResult | null>(null);
  const [showUTurnAnalysis, setShowUTurnAnalysis] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (selectedFile) {
        if (
          !selectedFile.name.endsWith(".xml") &&
          !selectedFile.name.endsWith(".osm")
        ) {
          toast.error("Please select an OSM XML file (.xml or .osm)");
          return;
        }

        setFile(selectedFile);
        setResult(null);
        setLogs([]);

        const reader = new FileReader();
        reader.onload = (e) => {
          setFileContent(e.target?.result as string);
          toast.success(`File loaded: ${selectedFile.name}`);
        };
        reader.onerror = () => {
          toast.error("Failed to read file");
        };
        reader.readAsText(selectedFile);
      }
    },
    []
  );

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      if (
        !droppedFile.name.endsWith(".xml") &&
        !droppedFile.name.endsWith(".osm")
      ) {
        toast.error("Please drop an OSM XML file (.xml or .osm)");
        return;
      }

      setFile(droppedFile);
      setResult(null);
      setLogs([]);

      const reader = new FileReader();
      reader.onload = (e) => {
        setFileContent(e.target?.result as string);
        toast.success(`File loaded: ${droppedFile.name}`);
      };
      reader.readAsText(droppedFile);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!fileContent) {
      toast.error("Please upload an OSM file first");
      return;
    }

    // Validate custom start point if enabled
    let customStart: StartPoint | null = null;
    if (useCustomStart) {
      const lat = parseFloat(startLat);
      const lon = parseFloat(startLon);
      if (isNaN(lat) || isNaN(lon)) {
        toast.error("Please enter valid coordinates for the starting point");
        return;
      }
      if (lat < -90 || lat > 90) {
        toast.error("Latitude must be between -90 and 90");
        return;
      }
      if (lon < -180 || lon > 180) {
        toast.error("Longitude must be between -180 and 180");
        return;
      }
      customStart = { lat, lon };
    }

    setIsProcessing(true);
    setProgress(0);
    setLogs([]);
    setResult(null);

    try {
      const result = await processRoute(
        fileContent,
        filename,
        ignoreOneways,
        (log) => {
          setLogs((prev) => [...prev, log]);
          setProgress((prev) => Math.min(prev + 8, 95));
        },
        customStart,
        penalties as TurnPenaltyConfig
      );

      setProgress(100);
      setResult(result);
      
      // Run U-turn detection
      try {
        const uTurnResult = detectUTurns(fileContent);
        setUTurnDetection(uTurnResult);
        if (uTurnResult.totalCount > 0) {
          setShowUTurnAnalysis(true);
          toast.success(`Route generated! Found ${uTurnResult.totalCount} U-turn features.`);
        } else {
          toast.success("Route generated successfully!");
        }
      } catch (uTurnError) {
        // U-turn detection is optional, don't fail the whole process
        console.warn("U-turn detection failed:", uTurnError);
        toast.success("Route generated successfully!");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Generation failed: ${message}`);
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: `Error: ${message}`,
          type: "error",
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  }, [fileContent, filename, ignoreOneways, useCustomStart, startLat, startLon]);

  const handleDownload = useCallback(() => {
    if (!result) return;

    const blob = new Blob([result.gpxContent], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("GPX file downloaded!");
  }, [result, filename]);

  const handleReset = useCallback(() => {
    setFile(null);
    setFileContent(null);
    setResult(null);
    setLogs([]);
    setProgress(0);
    setFilename("trash_route");
    setIgnoreOneways(true);
    setUseCustomStart(false);
    setStartLat("");
    setStartLon("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const getLogIcon = (type: ProcessingLog["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
      case "warning":
        return <AlertCircle className="w-3 h-3 text-amber-400" />;
      case "error":
        return <AlertCircle className="w-3 h-3 text-red-400" />;
      default:
        return <Info className="w-3 h-3 text-cyan-400" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ConsolePanel />
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/50 flex items-center justify-center glow-cyan">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold text-foreground">
                Trash Collection Route Planner
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                Chinese Postman Problem Solver
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge
              variant="outline"
              className="border-primary/50 text-primary font-mono text-xs"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
              SYSTEM READY
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 h-[calc(100vh-57px)] overflow-hidden">
        {/* Left Sidebar - Controls */}
        <aside className="w-80 border-r border-border/50 bg-sidebar flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="p-4 space-y-4">
              {/* File Upload */}
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" />
                    OSM File Input
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                      file
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-primary/5"
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xml,.osm"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {file ? (
                      <div className="space-y-1">
                        <FileText className="w-8 h-8 mx-auto text-primary" />
                        <p className="text-sm font-medium text-foreground truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Drop OSM file or click to browse
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          .xml or .osm format
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Configuration */}
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <Route className="w-4 h-4 text-primary" />
                    Route Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Output filename */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="filename"
                      className="text-xs text-muted-foreground"
                    >
                      Output Filename
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="filename"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        placeholder="trash_route"
                        className="font-mono text-sm bg-input/50 border-border/50"
                      />
                      <span className="text-xs text-muted-foreground">.gpx</span>
                    </div>
                  </div>

                  {/* One-way handling */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs text-muted-foreground">
                        Ignore One-Ways
                      </Label>
                      <p className="text-[10px] text-muted-foreground/70">
                        Collect both sides of one-way streets
                      </p>
                    </div>
                    <Switch
                      checked={ignoreOneways}
                      onCheckedChange={setIgnoreOneways}
                    />
                  </div>

                  <Separator className="bg-border/30" />

                  {/* Custom Start Point */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Crosshair className="w-3 h-3" />
                          Custom Start Point
                        </Label>
                        <p className="text-[10px] text-muted-foreground/70">
                          Use specific coordinates
                        </p>
                      </div>
                      <Switch
                        checked={useCustomStart}
                        onCheckedChange={setUseCustomStart}
                      />
                    </div>

                    {useCustomStart && (
                      <div className="space-y-2 pl-1 border-l-2 border-primary/30">
                        <div className="space-y-1.5 pl-3">
                          <Label
                            htmlFor="startLat"
                            className="text-xs text-muted-foreground"
                          >
                            Latitude
                          </Label>
                          <Input
                            id="startLat"
                            type="number"
                            step="any"
                            value={startLat}
                            onChange={(e) => setStartLat(e.target.value)}
                            placeholder="e.g., 45.5171"
                            className="font-mono text-sm bg-input/50 border-border/50"
                          />
                        </div>
                        <div className="space-y-1.5 pl-3">
                          <Label
                            htmlFor="startLon"
                            className="text-xs text-muted-foreground"
                          >
                            Longitude
                          </Label>
                          <Input
                            id="startLon"
                            type="number"
                            step="any"
                            value={startLon}
                            onChange={(e) => setStartLon(e.target.value)}
                            placeholder="e.g., -73.6070"
                            className="font-mono text-sm bg-input/50 border-border/50"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Turn Penalties Configuration */}
              <TurnPenaltiesConfig />

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  onClick={handleGenerate}
                  disabled={!fileContent || isProcessing}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-display glow-cyan"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Route className="w-4 h-4 mr-2" />
                      Generate Route
                    </>
                  )}
                </Button>

                {result && (
                  <Button
                    onClick={handleDownload}
                    variant="outline"
                    className="w-full border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download GPX
                  </Button>
                )}

                <Button
                  onClick={handleReset}
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Center - Map */}
        <main className="flex-1 relative overflow-hidden">
          {isProcessing && (
            <div className="absolute top-4 left-4 right-4 z-10">
              <Progress value={progress} className="h-1" />
            </div>
          )}

          <AnimatedLeafletMap
            route={result || null}
          />

          {!result && !isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center space-y-2 opacity-50">
                <MapPin className="w-16 h-16 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground font-display">
                  Upload an OSM file to visualize the route
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right Panel - Stats & Logs */}
        <aside className="w-96 border-l border-border/50 bg-sidebar flex flex-col">
          {/* Stats */}
          {result && (
            <div className="p-4 border-b border-border/50">
              <h3 className="text-sm font-display text-foreground mb-3 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary" />
                Route Statistics
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card/50 rounded-lg p-3 border border-border/30">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Ruler className="w-3 h-3" />
                    <span className="text-[10px] uppercase tracking-wider">
                      Distance
                    </span>
                  </div>
                  <p className="font-mono text-lg text-foreground">
                    {result.stats.totalDistanceKm.toFixed(2)}{" "}
                    <span className="text-xs text-muted-foreground">km</span>
                  </p>
                </div>
                <div className="bg-card/50 rounded-lg p-3 border border-border/30">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] uppercase tracking-wider">
                      Est. Time
                    </span>
                  </div>
                  <p className="font-mono text-lg text-foreground">
                    {result.stats.driveTimeMin.toFixed(0)}{" "}
                    <span className="text-xs text-muted-foreground">min</span>
                  </p>
                </div>
                <div className="bg-card/50 rounded-lg p-3 border border-border/30">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Route className="w-3 h-3" />
                    <span className="text-[10px] uppercase tracking-wider">
                      Traversals
                    </span>
                  </div>
                  <p className="font-mono text-lg text-foreground">
                    {result.stats.totalTraversals.toLocaleString()}
                  </p>
                </div>
                <div className="bg-card/50 rounded-lg p-3 border border-border/30">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MapPin className="w-3 h-3" />
                    <span className="text-[10px] uppercase tracking-wider">
                      Waypoints
                    </span>
                  </div>
                  <p className="font-mono text-lg text-foreground">
                    {result.coordinates.length.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="text-xs">
                  <p className="text-muted-foreground">Nodes</p>
                  <p className="font-mono text-foreground">
                    {result.stats.nodeCount}
                  </p>
                </div>
                <div className="text-xs">
                  <p className="text-muted-foreground">Edges</p>
                  <p className="font-mono text-foreground">
                    {result.stats.edgeCount}
                  </p>
                </div>
                <div className="text-xs">
                  <p className="text-muted-foreground">Components</p>
                  <p className="font-mono text-foreground">
                    {result.stats.connectedComponents}
                  </p>
                </div>
              </div>

              {/* Turn Statistics */}
              <div className="mt-4 pt-3 border-t border-border/30">
                <p className="text-xs text-muted-foreground mb-2">Turn Statistics</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/30">
                    <p className="text-[10px] text-emerald-400 uppercase">Right</p>
                    <p className="font-mono text-lg text-emerald-400">
                      {result.stats.rightTurnCount}
                    </p>
                  </div>
                  <div className="bg-amber-500/10 rounded-lg p-2 border border-amber-500/30">
                    <p className="text-[10px] text-amber-400 uppercase">Left</p>
                    <p className="font-mono text-lg text-amber-400">
                      {result.stats.leftTurnCount}
                    </p>
                  </div>
                  <div className={`rounded-lg p-2 border ${
                    result.stats.uTurnCount === 0 
                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <p className={`text-[10px] uppercase ${
                      result.stats.uTurnCount === 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>U-Turns</p>
                    <p className={`font-mono text-lg ${
                      result.stats.uTurnCount === 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {result.stats.uTurnCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* U-Turn Detection Results */}
          {uTurnDetection && showUTurnAnalysis && (
            <div className="px-4 py-3 border-b border-border/50">
              <UTurnDetectionPanel result={uTurnDetection} />
            </div>
          )}

          {/* Processing Logs */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-display text-foreground">
                Processing Log
              </h3>
              {isProcessing && (
                <Loader2 className="w-3 h-3 ml-auto animate-spin text-primary" />
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-1 font-mono text-xs">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground/50 text-center py-8">
                    Awaiting input...
                  </p>
                ) : (
                  logs.map((log, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 py-1 px-2 rounded hover:bg-muted/30"
                    >
                      {getLogIcon(log.type)}
                      <span className="text-muted-foreground/70">
                        [{log.timestamp.toLocaleTimeString()}]
                      </span>
                      <span
                        className={
                          log.type === "error"
                            ? "text-red-400"
                            : log.type === "success"
                            ? "text-emerald-400"
                            : log.type === "warning"
                            ? "text-amber-400"
                            : "text-foreground/80"
                        }
                      >
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </div>
        </aside>
      </div>
    </div>
  );
}
