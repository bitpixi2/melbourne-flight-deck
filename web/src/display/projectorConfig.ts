import {
  DEFAULT_CONFIG,
  MI_TO_KM,
  RIDDELLS_CREEK_VIEWPOINT,
  type Config,
} from "@shared/index.js";

const HOME_RADIUS_MILES = 70 / MI_TO_KM;

export const PROJECTOR_SKY_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  centerLat: RIDDELLS_CREEK_VIEWPOINT.lat,
  centerLon: RIDDELLS_CREEK_VIEWPOINT.lon,
  locationName: RIDDELLS_CREEK_VIEWPOINT.name,
  radiusMiles: HOME_RADIUS_MILES,
  projectionMode: "sky",
  mirrorX: true,
  showAirport: false,
  rangeRings: false,
  compass: false,
  showStars: true,
  showSun: true,
  showMoon: true,
  showSatellites: true,
  showPlanets: true,
  showDestArc: false,
  showRouteDetail: false,
  glyphSizePx: 28,
  trailSeconds: 75,
  trailOpacity: 0.72,
  labelDensity: "nearestOnly",
  nearestN: 1,
  showFields: {
    name: true,
    type: true,
    altitude: true,
    speed: true,
    verticalRate: false,
    destination: false,
    registration: false,
  },
};

export const PROJECTOR_RUNWAY_CONFIG: Config = {
  ...PROJECTOR_SKY_CONFIG,
  projectionMode: "map",
  mirrorX: false,
  showAirport: true,
  rangeRings: true,
  compass: true,
  showStars: false,
  showSun: false,
  showMoon: false,
  showSatellites: false,
  showPlanets: false,
  labelDensity: "nearestN",
  nearestN: 3,
};
