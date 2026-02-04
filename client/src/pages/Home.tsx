/**
 * Trash Collection Route Planner - Home Page
 * Design: Command Center Interface - Mobile Optimized
 * - Dark theme with electric cyan accents
 * - Responsive layout: stacked on mobile, three-column on desktop
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Menu,
  X,
  FileJson,
  Sheet,
} from "lucide-react";
import {
  processRoute,
  ProcessingLog,
  RouteResult,
  StartPoint,
  TurnPenaltyConfig,
  exportRouteAsJSON,
  exportRouteAsCSV,
  downloadFile,
} from "@/lib/routeProcessor";
import { useTurnPenalties } from "@/contexts/TurnPenaltiesContext";
import { detectUTurns, UTurnDetectionResult } from "@/lib/uTurnDetector";
import AnimatedLeafletMap from "@/components/AnimatedLeafletMap";
import TurnPenaltiesConfig from "@/components/TurnPenaltiesConfig";
import UTurnDetectionPanel from "@/components/UTurnDetectionPanel";
import ConsolePanel from "@/components/ConsolePanel";

export default function Home() {
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

  // Mobile state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("map");

  const logsEndRef = useRef<HTMLDivElement>(null);

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
          toast.error("Please select an OSM XML file");
          return;
        }

        setFile(selectedFile);
        setResult(null);
        setLogs([]);

        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setFileContent(content);
        };
        reader.readAsText(selectedFile);
      }
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        const event = {
          target: { files: [droppedFile] },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFileSelect(event);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleGenerate = useCallback(async () => {
    if (!fileContent) {
      toast.error("Please upload an OSM file first");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setLogs([]);

    try {
      const startPoint: StartPoint | undefined = useCustomStart
        ? { lat: parseFloat(startLat), lon: parseFloat(startLon) }
        : undefined;

      const penaltyConfig: TurnPenaltyConfig = {
        straight: penalties.straight,
        rightTurn: penalties.rightTurn,
        leftTurn: penalties.leftTurn,
        uTurn: penalties.uTurn,
      };

      const result = await processRoute(
        fileContent,
        filename,
        ignoreOneways,
        (log: ProcessingLog) => {
          setLogs((prev) => [...prev, log]);
          setProgress((prev) => Math.min(prev + 5, 95));
        },
        startPoint,
        penaltyConfig
      );

      setResult(result);
      setProgress(100);
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Route generation complete!",
          type: "success",
        },
      ]);

      try {
        const uTurnResult = detectUTurns(fileContent);
        setUTurnDetection(uTurnResult);
      } catch (uTurnError) {
        console.warn("U-turn detection failed:", uTurnError);
      }

      toast.success("Route generated successfully!");
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
  }, [fileContent, filename, ignoreOneways, useCustomStart, startLat, startLon, penalties]);

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

  const handleExportJSON = useCallback(() => {
    if (!result) return;
    const jsonContent = exportRouteAsJSON(result);
    downloadFile(jsonContent, `${filename}_route.json`, "application/json");
    toast.success("Route data exported as JSON!");
  }, [result, filename]);

  const handleExportCSV = useCallback(() => {
    if (!result) return;
    const csvContent = exportRouteAsCSV(result);
    downloadFile(csvContent, `${filename}_route.csv`, "text/csv");
    toast.success("Route data exported as CSV!");
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
        <div className="flex items-center justify-between px-4 lg:px-6 py-3">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-8 lg:w-10 h-8 lg:h-10 rounded-lg bg-primary/20 border border-primary/50 flex items-center justify-center">
              <Truck className="w-4 lg:w-5 h-4 lg:h-5 text-primary" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-display text-sm lg:text-lg font-semibold text-foreground">
                Trash Route Planner
              </h1>
              <p className="text-xs text-muted-foreground font-mono hidden md:block">
                Chinese Postman Solver
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <Badge
              variant="outline"
              className="border-primary/50 text-primary font-mono text-xs"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
              READY
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Sidebar - Mobile Drawer / Desktop Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "block" : "hidden"
          } lg:block w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border/50 bg-sidebar overflow-hidden`}
        >
          <ScrollArea className="h-full">
            <div className="p-3 lg:p-4 space-y-3 lg:space-y-4">
              {/* File Upload */}
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-2 lg:pb-3">
                  <CardTitle className="text-xs lg:text-sm font-display flex items-center gap-2">
                    <Upload className="w-3 lg:w-4 h-3 lg:h-4 text-primary" />
                    OSM File
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer text-xs lg:text-sm ${
                      file
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-primary/30"
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
                        <FileText className="w-6 lg:w-8 h-6 lg:h-8 mx-auto text-primary" />
                        <p className="font-medium text-foreground truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-6 lg:w-8 h-6 lg:h-8 mx-auto text-muted-foreground" />
                        <p className="text-muted-foreground">Drop or click</p>
                        <p className="text-xs text-muted-foreground/70">.xml or .osm</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Route Configuration */}
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-2 lg:pb-3">
                  <CardTitle className="text-xs lg:text-sm font-display flex items-center gap-2">
                    <Route className="w-3 lg:w-4 h-3 lg:h-4 text-primary" />
                    Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs lg:text-sm">Filename</Label>
                    <Input
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      placeholder="trash_route"
                      className="h-8 text-xs lg:text-sm"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs lg:text-sm">Ignore One-Ways</Label>
                    <Switch
                      checked={ignoreOneways}
                      onCheckedChange={setIgnoreOneways}
                    />
                  </div>

                  <Separator className="my-2" />

                  <div className="flex items-center justify-between">
                    <Label className="text-xs lg:text-sm">Custom Start</Label>
                    <Switch
                      checked={useCustomStart}
                      onCheckedChange={setUseCustomStart}
                    />
                  </div>

                  {useCustomStart && (
                    <div className="space-y-2">
                      <Input
                        type="number"
                        placeholder="Latitude"
                        value={startLat}
                        onChange={(e) => setStartLat(e.target.value)}
                        step="0.0001"
                        className="h-8 text-xs lg:text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="Longitude"
                        value={startLon}
                        onChange={(e) => setStartLon(e.target.value)}
                        step="0.0001"
                        className="h-8 text-xs lg:text-sm"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Turn Penalties */}
              <TurnPenaltiesConfig />

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <Button
                  onClick={handleGenerate}
                  disabled={!file || isProcessing}
                  className="w-full h-9 text-xs lg:text-sm"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Route className="w-3 h-3 mr-1" />
                      Generate Route
                    </>
                  )}
                </Button>

                {result && (
                  <>
                    <Button
                      onClick={handleDownload}
                      variant="outline"
                      className="w-full h-9 text-xs lg:text-sm"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download GPX
                    </Button>
                    <Button
                      onClick={handleExportJSON}
                      variant="outline"
                      className="w-full h-9 text-xs lg:text-sm"
                    >
                      <FileJson className="w-3 h-3 mr-1" />
                      Export JSON
                    </Button>
                    <Button
                      onClick={handleExportCSV}
                      variant="outline"
                      className="w-full h-9 text-xs lg:text-sm"
                    >
                      <Sheet className="w-3 h-3 mr-1" />
                      Export CSV
                    </Button>
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="w-full h-9 text-xs lg:text-sm"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Reset
                    </Button>
                  </>
                )}
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Tabs for Mobile */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col lg:hidden min-h-0"
          >
            <TabsList className="w-full rounded-none border-b border-border/30">
              <TabsTrigger value="map" className="flex-1 text-xs">
                Map
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex-1 text-xs">
                Stats
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex-1 text-xs">
                Logs
              </TabsTrigger>
            </TabsList>

            {/* Map Tab */}
            <TabsContent value="map" className="flex-1 overflow-hidden m-0 p-0 min-h-0">
              <div className="w-full h-full flex flex-col" style={{ height: '100%', minHeight: 0 }}>
                <AnimatedLeafletMap route={result} />
              </div>
            </TabsContent>

            {/* Stats Tab */}
            <TabsContent value="stats" className="flex-1 overflow-auto m-0 p-3">
              {result ? (
                <div className="space-y-3">
                  <Card className="border-border/50 bg-card/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs lg:text-sm">Route Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs lg:text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Distance:</span>
                        <span className="font-mono">{result.stats.totalDistanceKm.toFixed(2)} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time:</span>
                        <span className="font-mono">{result.stats.driveTimeMin} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Traversals:</span>
                        <span className="font-mono">{result.stats.totalTraversals}</span>
                      </div>
                    </CardContent>
                  </Card>

                      {uTurnDetection && (
                    <UTurnDetectionPanel result={uTurnDetection} />
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Generate a route to see statistics
                </p>
              )}
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="flex-1 overflow-auto m-0 p-3">
              <div className="space-y-1 text-xs font-mono">
                {logs.map((log, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    {getLogIcon(log.type)}
                    <span className="text-muted-foreground flex-1">{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </TabsContent>
          </Tabs>

          {/* Desktop Layout */}
          <div className="hidden lg:flex flex-1 overflow-hidden gap-4 p-4">
            {/* Map */}
            <div className="flex-1 min-w-0">
              <AnimatedLeafletMap route={result} />
            </div>

            {/* Right Panel - Stats */}
            <div className="w-96 border border-border/30 rounded bg-card/50 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {result ? (
                    <>
                      {/* Route Statistics */}
                      <Card className="border-border/50 bg-background/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Route className="w-4 h-4 text-primary" />
                            Route Statistics
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Distance</p>
                              <p className="font-mono text-sm font-semibold text-primary">
                                {result.stats.totalDistanceKm.toFixed(2)} km
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Est. Time</p>
                              <p className="font-mono text-sm font-semibold text-primary">
                                {result.stats.driveTimeMin} min
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Traversals</p>
                              <p className="font-mono text-sm font-semibold">
                                {result.stats.totalTraversals}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Waypoints</p>
                              <p className="font-mono text-sm font-semibold">
                                {result.coordinates.length}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* U-Turn Detection */}
                      {uTurnDetection && (
                        <UTurnDetectionPanel result={uTurnDetection} />
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Generate a route to see statistics
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
