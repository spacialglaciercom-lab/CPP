/**
 * RouteMap Component
 * Design: Command Center Interface
 * - Displays route on an interactive map using Google Maps
 * - Grid overlay for technical feel
 * - Glowing route line
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { MapView } from "@/components/Map";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation } from "lucide-react";

interface RouteMapProps {
  coordinates: Array<{ lat: number; lon: number }>;
  bounds?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export default function RouteMap({ coordinates, bounds }: RouteMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const startMarkerRef = useRef<google.maps.Marker | null>(null);
  const endMarkerRef = useRef<google.maps.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);

    // Set dark map style for Command Center theme
    map.setOptions({
      styles: [
        { elementType: "geometry", stylers: [{ color: "#1a1f2e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#1a1f2e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
        {
          featureType: "administrative",
          elementType: "geometry.stroke",
          stylers: [{ color: "#374151" }],
        },
        {
          featureType: "road",
          elementType: "geometry",
          stylers: [{ color: "#2d3748" }],
        },
        {
          featureType: "road",
          elementType: "geometry.stroke",
          stylers: [{ color: "#1f2937" }],
        },
        {
          featureType: "road.highway",
          elementType: "geometry",
          stylers: [{ color: "#3f4f6f" }],
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#0f172a" }],
        },
        {
          featureType: "poi",
          elementType: "geometry",
          stylers: [{ color: "#1e293b" }],
        },
        {
          featureType: "poi.park",
          elementType: "geometry",
          stylers: [{ color: "#1a2e1a" }],
        },
        {
          featureType: "transit",
          elementType: "geometry",
          stylers: [{ color: "#2d3748" }],
        },
      ],
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
  }, []);

  // Update route when coordinates change
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    // Clear existing polyline and markers
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    if (startMarkerRef.current) {
      startMarkerRef.current.setMap(null);
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.setMap(null);
      endMarkerRef.current = null;
    }

    if (coordinates.length === 0) return;

    // Create path from coordinates
    const path = coordinates.map(
      (coord) => new google.maps.LatLng(coord.lat, coord.lon)
    );

    // Create glowing polyline effect with multiple layers
    // Background glow
    const glowPolyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#06b6d4",
      strokeOpacity: 0.3,
      strokeWeight: 8,
      map: mapRef.current,
    });

    // Main route line
    polylineRef.current = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#22d3ee",
      strokeOpacity: 1,
      strokeWeight: 3,
      map: mapRef.current,
    });

    // Start marker
    const startCoord = coordinates[0];
    startMarkerRef.current = new google.maps.Marker({
      position: { lat: startCoord.lat, lng: startCoord.lon },
      map: mapRef.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#22c55e",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      title: "Start Point",
    });

    // End marker (same as start for circuit)
    const endCoord = coordinates[coordinates.length - 1];
    if (
      Math.abs(endCoord.lat - startCoord.lat) > 0.0001 ||
      Math.abs(endCoord.lon - startCoord.lon) > 0.0001
    ) {
      endMarkerRef.current = new google.maps.Marker({
        position: { lat: endCoord.lat, lng: endCoord.lon },
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#ef4444",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        title: "End Point",
      });
    }

    // Fit bounds
    if (bounds) {
      const mapBounds = new google.maps.LatLngBounds(
        { lat: bounds.minLat, lng: bounds.minLon },
        { lat: bounds.maxLat, lng: bounds.maxLon }
      );
      mapRef.current.fitBounds(mapBounds, 50);
    }

    // Cleanup glow polyline on unmount
    return () => {
      glowPolyline.setMap(null);
    };
  }, [coordinates, bounds, mapReady]);

  return (
    <div className="relative w-full h-full">
      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 grid-overlay opacity-30" />

      {/* Map */}
      <MapView
        onMapReady={handleMapReady}
        className="w-full h-full"
        initialCenter={{ lat: 45.5171, lng: -73.6070 }}
        initialZoom={14}
      />

      {/* Coordinate display */}
      {coordinates.length > 0 && (
        <div className="absolute bottom-4 left-4 z-20 space-y-2">
          <Badge
            variant="outline"
            className="bg-card/90 backdrop-blur-sm border-emerald-500/50 text-emerald-400 font-mono text-xs"
          >
            <MapPin className="w-3 h-3 mr-1" />
            Start: {coordinates[0].lat.toFixed(6)}, {coordinates[0].lon.toFixed(6)}
          </Badge>
          <Badge
            variant="outline"
            className="bg-card/90 backdrop-blur-sm border-primary/50 text-primary font-mono text-xs block"
          >
            <Navigation className="w-3 h-3 mr-1 inline" />
            {coordinates.length.toLocaleString()} waypoints
          </Badge>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 right-4 z-20 bg-card/90 backdrop-blur-sm rounded-lg p-3 border border-border/50">
        <p className="text-xs font-display text-muted-foreground mb-2">Legend</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-foreground/80">Start Point</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-6 h-0.5 bg-cyan-400 rounded" />
            <span className="text-foreground/80">Route Path</span>
          </div>
        </div>
      </div>
    </div>
  );
}
