/**
 * Animated Leaflet Map Component
 * Displays route with animated truck and blue/red line transitions
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RouteResult } from '@/lib/routeProcessor';
import { RouteAnimator, RouteCoordinate, AnimationState } from '@/lib/routeAnimator';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface AnimatedLeafletMapProps {
  route: RouteResult | null;
}

export default function AnimatedLeafletMap({ route }: AnimatedLeafletMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const animator = useRef<RouteAnimator | null>(null);
  const truckMarker = useRef<L.Marker | null>(null);
  const routePolylines = useRef<Map<number, L.Polyline>>(new Map());
  const [animationState, setAnimationState] = useState<AnimationState | null>(null);
  const [speed, setSpeed] = useState(1);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = L.map(mapContainer.current).setView([45.5, -73.6], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 19,
    }).addTo(map.current);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Load route and create polylines
  useEffect(() => {
    if (!route || !map.current) return;

    // Clear existing polylines
    routePolylines.current.forEach((polyline) => polyline.remove());
    routePolylines.current.clear();

    // Create polylines for each edge
    const coordinates: RouteCoordinate[] = [];
    const edgePolylines = new Map<number, { coords: [number, number][]; edgeKey: number }>();

    route.coordinates.forEach((coord, idx) => {
      coordinates.push({
        lat: coord[0],
        lon: coord[1],
        edgeKey: route.edgeSequence?.[idx],
      });
    });

    // Group coordinates by edge
    let currentEdgeKey: number | undefined;
    let currentEdgeCoords: [number, number][] = [];

    route.coordinates.forEach((coord, idx) => {
      const edgeKey = route.edgeSequence?.[idx];

      if (edgeKey !== currentEdgeKey && currentEdgeCoords.length > 0) {
        if (currentEdgeKey !== undefined) {
          edgePolylines.set(currentEdgeKey, {
            coords: currentEdgeCoords,
            edgeKey: currentEdgeKey,
          });
        }
        currentEdgeCoords = [];
      }

      currentEdgeCoords.push([coord[0], coord[1]]);
      currentEdgeKey = edgeKey;
    });

    if (currentEdgeCoords.length > 0 && currentEdgeKey !== undefined) {
      edgePolylines.set(currentEdgeKey, {
        coords: currentEdgeCoords,
        edgeKey: currentEdgeKey,
      });
    }

    // Create polylines on map
    edgePolylines.forEach(({ coords, edgeKey }) => {
      const polyline = L.polyline(coords, {
        color: '#00d9ff',
        weight: 3,
        opacity: 0.8,
      }).addTo(map.current!);

      routePolylines.current.set(edgeKey, polyline);
    });

    // Fit bounds
    const allCoords = route.coordinates.map((c) => [c[0], c[1]] as [number, number]);
    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      map.current.fitBounds(bounds, { padding: [50, 50] });
    }

    // Create animator
    animator.current = new RouteAnimator(coordinates, speed);

    animator.current.setOnProgressUpdate((state) => {
      setAnimationState(state);

      // Update truck marker
      if (!truckMarker.current) {
        const truckIcon = L.divIcon({
          html: `<div style="width: 30px; height: 30px; background: #00d9ff; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px #00d9ff;"><div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div></div>`,
          iconSize: [30, 30],
          className: 'truck-marker',
        });
        truckMarker.current = L.marker([state.truckLat, state.truckLon], {
          icon: truckIcon,
        }).addTo(map.current!);
      } else {
        truckMarker.current.setLatLng([state.truckLat, state.truckLon]);
      }
    });

    animator.current.setOnEdgeComplete((edgeKey) => {
      const polyline = routePolylines.current.get(edgeKey);
      if (polyline) {
        polyline.setStyle({ color: '#ff0000', opacity: 1 });
      }
    });
  }, [route, speed]);

  const handlePlay = () => {
    animator.current?.play();
  };

  const handlePause = () => {
    animator.current?.pause();
  };

  const handleReset = () => {
    animator.current?.reset();
    setAnimationState(null);

    // Reset all polylines to blue
    routePolylines.current.forEach((polyline) => {
      polyline.setStyle({ color: '#00d9ff', opacity: 0.8 });
    });

    if (truckMarker.current) {
      truckMarker.current.remove();
      truckMarker.current = null;
    }
  };

  const handleSpeedChange = (value: number[]) => {
    const newSpeed = value[0];
    setSpeed(newSpeed);
    animator.current?.setSpeed(newSpeed);
  };

  if (!route) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background/50 rounded-lg border border-border/30">
        <p className="text-muted-foreground">Upload OSM file and generate route to animate</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background/50 rounded-lg border border-border/30 overflow-hidden">
      {/* Map */}
      <div ref={mapContainer} className="flex-1 w-full" />

      {/* Controls */}
      <div className="bg-card/80 border-t border-border/30 p-3 space-y-3">
        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{animationState ? `${(animationState.progress * 100).toFixed(1)}%` : '0%'}</span>
          </div>
          <div className="w-full bg-background/50 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${(animationState?.progress || 0) * 100}%` }}
            />
          </div>
        </div>

        {/* Speed Control */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Speed</span>
            <span>{speed.toFixed(1)}x</span>
          </div>
          <Slider
            value={[speed]}
            onValueChange={handleSpeedChange}
            min={0.1}
            max={5}
            step={0.1}
            className="w-full"
          />
        </div>

        {/* Playback Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handlePlay}
            disabled={animationState?.isPlaying}
            size="sm"
            className="flex-1"
          >
            <Play className="w-3 h-3 mr-1" />
            Play
          </Button>
          <Button
            onClick={handlePause}
            disabled={!animationState?.isPlaying}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Pause className="w-3 h-3 mr-1" />
            Pause
          </Button>
          <Button onClick={handleReset} variant="outline" size="sm" className="flex-1">
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>

        {/* Stats */}
        {animationState && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-background/50 rounded p-2">
              <p className="text-muted-foreground">Completed</p>
              <p className="font-display text-primary">{animationState.completedEdges.size}</p>
            </div>
            <div className="bg-background/50 rounded p-2">
              <p className="text-muted-foreground">Total</p>
              <p className="font-display text-foreground">{route.stats.totalTraversals}</p>
            </div>
            <div className="bg-background/50 rounded p-2">
              <p className="text-muted-foreground">Remaining</p>
              <p className="font-display text-amber-400">
                {route.stats.totalTraversals - animationState.completedEdges.size}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
