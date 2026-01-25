/**
 * Animated Leaflet Map Component
 * Displays route with animated truck and playback controls
 * CRITICAL: Uses explicit width/height styling to fix invisible map issues
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

// Fix Leaflet icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export default function AnimatedLeafletMap({ route }: AnimatedLeafletMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const animator = useRef<RouteAnimator | null>(null);
  const truckMarker = useRef<L.Marker | null>(null);
  const routePolyline = useRef<L.Polyline | null>(null);
  const [animationState, setAnimationState] = useState<AnimationState | null>(null);
  const [speed, setSpeed] = useState(1);

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // CRITICAL: Set explicit dimensions on container
    mapContainer.current.style.width = '100%';
    mapContainer.current.style.height = '100%';

    console.log('Initializing map container:', {
      width: mapContainer.current.style.width,
      height: mapContainer.current.style.height,
      offsetWidth: mapContainer.current.offsetWidth,
      offsetHeight: mapContainer.current.offsetHeight,
    });

    try {
      map.current = L.map(mapContainer.current, {
        center: [45.5017, -73.5673],
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map.current);

      console.log('Map initialized successfully');

      // Trigger map resize
      setTimeout(() => {
        if (map.current) {
          map.current.invalidateSize();
          console.log('Map size invalidated');
        }
      }, 100);
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Load route and setup animation
  useEffect(() => {
    if (!route || !map.current) return;

    console.log('Loading route with', route.coordinates.length, 'coordinates');

    // Remove existing polyline and markers
    if (routePolyline.current) {
      routePolyline.current.remove();
      routePolyline.current = null;
    }
    if (truckMarker.current) {
      truckMarker.current.remove();
      truckMarker.current = null;
    }

    const coords = route.coordinates as [number, number][];
    if (coords.length === 0) {
      console.warn('No coordinates in route');
      return;
    }

    try {
      // Draw route polyline
      routePolyline.current = L.polyline(coords, {
        color: '#00d9ff',
        weight: 3,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map.current);

      console.log('Route polyline added');

      // Fit map to route bounds
      const bounds = L.latLngBounds(coords);
      map.current.fitBounds(bounds, { padding: [50, 50] });

      console.log('Map fitted to bounds');

      // Invalidate size to ensure proper rendering
      setTimeout(() => {
        if (map.current) {
          map.current.invalidateSize();
          console.log('Map size re-invalidated after route load');
        }
      }, 100);

      // Create coordinates for animator
      const animCoords: RouteCoordinate[] = coords.map((coord, idx) => ({
        lat: coord[0],
        lon: coord[1],
        edgeKey: idx,
      }));

      // Create animator
      animator.current = new RouteAnimator(animCoords, speed);

      animator.current.setOnProgressUpdate((state) => {
        setAnimationState(state);

        // Update truck marker
        if (!truckMarker.current) {
          const truckIcon = L.divIcon({
            html: `<div style="width: 30px; height: 30px; background: #00d9ff; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px #00d9ff;"><div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            className: 'truck-marker',
          });
          truckMarker.current = L.marker([state.truckLat, state.truckLon], {
            icon: truckIcon,
            zIndexOffset: 1000,
          }).addTo(map.current!);
        } else {
          truckMarker.current.setLatLng([state.truckLat, state.truckLon]);
        }
      });

      console.log('Animator created and configured');
    } catch (error) {
      console.error('Error loading route:', error);
    }
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
    <div className="w-full h-full flex flex-col bg-background rounded-lg border border-border/30 overflow-hidden">
      {/* Map Container - CRITICAL: ref must have explicit dimensions */}
      <div
        ref={mapContainer}
        className="flex-1 w-full bg-background"
        style={{
          width: '100%',
          height: '100%',
          minHeight: '0',
          minWidth: '0',
        }}
      />

      {/* Controls Panel */}
      <div className="bg-card/90 border-t border-border/30 p-4 space-y-3 flex-shrink-0">
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
