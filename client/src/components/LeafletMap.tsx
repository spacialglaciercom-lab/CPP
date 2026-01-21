/**
 * Leaflet Map Component
 * Displays trash collection routes on an interactive map
 * Design: Command Center Interface with dark theme
 */

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RouteResult } from "@/lib/routeProcessor";

interface LeafletMapProps {
  route?: RouteResult;
  startPoint?: { lat: number; lon: number };
}

// Fix Leaflet icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export default function LeafletMap({ route, startPoint }: LeafletMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const routeLayer = useRef<L.Polyline | null>(null);
  const startMarker = useRef<L.Marker | null>(null);
  const endMarker = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapContainer.current, {
        center: [45.5017, -73.5673], // Default to Montreal
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
      });

      // Add dark theme tile layer
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }
      ).addTo(mapInstance.current);
    }

    // Clear existing layers
    if (routeLayer.current) {
      mapInstance.current.removeLayer(routeLayer.current);
      routeLayer.current = null;
    }
    if (startMarker.current) {
      mapInstance.current.removeLayer(startMarker.current);
      startMarker.current = null;
    }
    if (endMarker.current) {
      mapInstance.current.removeLayer(endMarker.current);
      endMarker.current = null;
    }

    // Display route if available
    if (route && route.coordinates.length > 0) {
      const coordinates = route.coordinates.map((coord) => [
        coord.lat,
        coord.lon,
      ] as [number, number]);

      // Draw route polyline
      routeLayer.current = L.polyline(coordinates, {
        color: "#00d4ff", // Cyan for command center aesthetic
        weight: 3,
        opacity: 0.8,
        lineCap: "round",
        lineJoin: "round",
        dashArray: "5, 5",
      }).addTo(mapInstance.current);

      // Add start marker
      if (coordinates.length > 0) {
        startMarker.current = L.marker(coordinates[0], {
          icon: L.icon({
            iconUrl:
              "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI4IiBmaWxsPSIjMDBkNGZmIiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==",
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        })
          .bindPopup("<b>Start Point</b>")
          .addTo(mapInstance.current);
      }

      // Add end marker
      if (coordinates.length > 1) {
        endMarker.current = L.marker(coordinates[coordinates.length - 1], {
          icon: L.icon({
            iconUrl:
              "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI4IiBmaWxsPSIjMjJjNTVlIiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==",
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        })
          .bindPopup("<b>End Point</b>")
          .addTo(mapInstance.current);
      }

      // Fit map to route bounds
      if (coordinates.length > 0) {
        const bounds = L.latLngBounds(coordinates);
        mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
      }
    } else if (startPoint) {
      // Center on start point if no route
      mapInstance.current.setView([startPoint.lat, startPoint.lon], 13);

      startMarker.current = L.marker([startPoint.lat, startPoint.lon], {
        icon: L.icon({
          iconUrl:
            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI4IiBmaWxsPSIjMDBkNGZmIiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      })
        .bindPopup("<b>Start Point</b>")
        .addTo(mapInstance.current);
    }
  }, [route, startPoint]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full rounded-lg border border-border/30 bg-background overflow-hidden"
      style={{ minHeight: "400px" }}
    />
  );
}
