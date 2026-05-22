declare namespace google.maps {
  class Map {
    constructor(element: HTMLElement, opts: MapOptions);
    panTo(latLng: LatLngLiteral): void;
    setZoom(zoom: number): void;
  }

  class Marker {
    constructor(opts: MarkerOptions);
    addListener(eventName: string, handler: () => void): void;
    setIcon(icon: Symbol): void;
    setMap(map: Map | null): void;
  }

  enum SymbolPath {
    CIRCLE = 0,
  }

  type LatLngLiteral = { lat: number; lng: number };
  type MapOptions = {
    center: LatLngLiteral;
    zoom: number;
    mapTypeControl?: boolean;
    streetViewControl?: boolean;
    fullscreenControl?: boolean;
  };
  type MarkerOptions = {
    map: Map;
    position: LatLngLiteral;
    title?: string;
    icon?: Symbol;
  };
  type Symbol = {
    path: SymbolPath;
    fillColor: string;
    fillOpacity: number;
    strokeColor: string;
    strokeWeight: number;
    scale: number;
  };
}

interface Window {
  google?: {
    maps: {
      Map: typeof google.maps.Map;
      Marker: typeof google.maps.Marker;
      SymbolPath: typeof google.maps.SymbolPath;
    };
  };
}
