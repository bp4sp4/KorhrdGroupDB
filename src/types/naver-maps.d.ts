// 네이버 지도 JavaScript API v3 타입 선언

declare namespace naver.maps {
  class Map {
    constructor(el: HTMLElement, options?: MapOptions);
    setCenter(latlng: LatLng): void;
    setZoom(level: number): void;
    getCenter(): LatLng;
    getZoom(): number;
    fitBounds(bounds: LatLngBounds, margin?: number): void;
    panTo(latlng: LatLng, transitionOptions?: object): void;
    destroy(): void;
  }

  interface MapOptions {
    center?: LatLng;
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    zoomControl?: boolean;
    zoomControlOptions?: {
      position?: number;
    };
    mapTypeControl?: boolean;
    scaleControl?: boolean;
  }

  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
  }

  class LatLngBounds {
    constructor(sw: LatLng, ne: LatLng);
    extend(latlng: LatLng): LatLngBounds;
    static bounds(latlng: LatLng, latlng2: LatLng): LatLngBounds;
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
    getPosition(): LatLng;
    setIcon(icon: MarkerIcon | string): void;
  }

  interface MarkerOptions {
    position: LatLng;
    map?: Map;
    title?: string;
    icon?: MarkerIcon | string;
    zIndex?: number;
  }

  interface MarkerIcon {
    url?: string;
    content?: string;
    size?: Size;
    anchor?: Point;
    scaledSize?: Size;
  }

  class InfoWindow {
    constructor(options: InfoWindowOptions);
    open(map: Map, marker?: Marker): void;
    close(): void;
    setContent(content: string | HTMLElement): void;
  }

  interface InfoWindowOptions {
    content?: string | HTMLElement;
    maxWidth?: number;
    borderWidth?: number;
    borderColor?: string;
    backgroundColor?: string;
    disableAnchor?: boolean;
    pixelOffset?: Point;
  }

  class Size {
    constructor(width: number, height: number);
    width: number;
    height: number;
  }

  class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  class Event {
    static addListener(
      target: object,
      type: string,
      handler: (...args: unknown[]) => void,
    ): void;
    static removeListener(
      target: object,
      type: string,
      handler: (...args: unknown[]) => void,
    ): void;
  }

  const Position: {
    TOP_LEFT: number;
    TOP_CENTER: number;
    TOP_RIGHT: number;
    LEFT_CENTER: number;
    LEFT_TOP: number;
    LEFT_BOTTOM: number;
    RIGHT_TOP: number;
    RIGHT_CENTER: number;
    RIGHT_BOTTOM: number;
    BOTTOM_LEFT: number;
    BOTTOM_CENTER: number;
    BOTTOM_RIGHT: number;
  };
}
