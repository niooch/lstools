declare module "leaflet" {
  const leaflet: any;
  export = leaflet;
}

declare module "react-leaflet" {
  import * as React from "react";

  export const MapContainer: React.ComponentType<any>;
  export const TileLayer: React.ComponentType<any>;
  export const Marker: React.ComponentType<any>;
  export const Popup: React.ComponentType<any>;
  export const Polyline: React.ComponentType<any>;
  export const AttributionControl: React.ComponentType<any>;
  export function useMap(): any;
}
