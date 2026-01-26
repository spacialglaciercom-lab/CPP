/**
 * Animated Leaflet Map Component
 * Displays route with animated truck and playback controls
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RouteResult } from '@/lib/routeProcessor';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface AnimatedLeafletMapProps {
  route: RouteResult | null;
}

export default function AnimatedLeafletMap({ route }: AnimatedLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const animationRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    console.log('Initializing Leaflet map...');

    try {
      const map = L.map(containerRef.current, {
        center: [45.5, -73.6],
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 20,
      }).addTo(map);

      mapRef.current = map;
      console.log('Map initialized successfully');

      // Force map to recalculate size
      setTimeout(() => {
        map.invalidateSize();
        console.log('Map size invalidated');
      }, 100);
    } catch (error) {
      console.error('Failed to initialize map:', error);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Load route
  useEffect(() => {
    if (!route || !mapRef.current) {
      console.log('No route or map available');
      return;
    }

    console.log('Loading route with', route.coordinates.length, 'coordinates');

    // Clear existing polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
    }

    const coords = route.coordinates as [number, number][];
    if (coords.length === 0) {
      console.warn('No coordinates in route');
      return;
    }

    // Draw polyline
    const polyline = L.polyline(coords, {
      color: '#00d9ff',
      weight: 3,
      opacity: 0.8,
    }).addTo(mapRef.current);

    polylineRef.current = polyline;

    // Fit bounds
    const bounds = L.latLngBounds(coords);
    mapRef.current.fitBounds(bounds, { padding: [50, 50] });

    console.log('Route loaded and bounds fitted');
  }, [route]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || !route) return;

    const coords = route.coordinates as [number, number][];
    if (coords.length === 0) return;

    const animate = () => {
      setCurrentIndex((prev) => {
        const next = prev + Math.max(1, Math.floor(speed));
        if (next >= coords.length) {
          setIsPlaying(false);
          return coords.length - 1;
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, route, speed]);

  // Update truck marker
  useEffect(() => {
    if (!route || !mapRef.current) return;

    const coords = route.coordinates as [number, number][];
    if (coords.length === 0 || currentIndex >= coords.length) return;

    const [lat, lon] = coords[currentIndex];

    if (!markerRef.current) {
      const icon = L.divIcon({
        html: `<div style="width: 24px; height: 24px; background: #00d9ff; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px #00d9ff;"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      markerRef.current = L.marker([lat, lon], { icon }).addTo(mapRef.current);
    } else {
      markerRef.current.setLatLng([lat, lon]);
    }

    setProgress(currentIndex / coords.length);
  }, [currentIndex, route]);

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleReset = () => {
    setCurrentIndex(0);
    setProgress(0);
    setIsPlaying(false);
  };

  if (!route) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background/50 border border-border/30 rounded">
        <p className="text-muted-foreground">Upload OSM file and generate route</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background border border-border/30 rounded overflow-hidden min-h-0">
      {/* Map Container */}
      <div
        ref={containerRef}
        className="flex-1 w-full bg-background min-h-0"
        style={{
          width: '100%',
          height: '100%',
          minHeight: 0,
        }}
      />

      {/* Controls */}
      <div className="bg-card/90 border-t border-border/30 p-3 space-y-2 flex-shrink-0">
        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="w-full bg-background/50 rounded h-2">
            <div
              className="bg-primary h-2 rounded transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* Speed */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Speed</span>
            <span>{speed.toFixed(1)}x</span>
          </div>
          <Slider
            value={[speed]}
            onValueChange={(v) => setSpeed(v[0])}
            min={0.1}
            max={5}
            step={0.1}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <Button onClick={handlePlay} disabled={isPlaying} size="sm" className="flex-1">
            <Play className="w-3 h-3 mr-1" />
            Play
          </Button>
          <Button onClick={handlePause} disabled={!isPlaying} variant="outline" size="sm" className="flex-1">
            <Pause className="w-3 h-3 mr-1" />
            Pause
          </Button>
          <Button onClick={handleReset} variant="outline" size="sm" className="flex-1">
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
