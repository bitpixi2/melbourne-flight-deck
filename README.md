# Brenton's Flight Deck

A live, full-screen flight display for a wall-mounted smart TV or touchscreen in
Victoria. It combines real aircraft positions around the home
area and Melbourne Airport with a current sky map, airport weather, and clocks.

This is a Melbourne-focused fork of [cpaczek/skylight](https://github.com/cpaczek/skylight).

## The display

Brenton's Flight Deck alternates every 45 seconds between two live views:

- **Runway view** — a top-down plan of Melbourne Airport (MEL/YMML), including
  its real runway geometry and aircraft moving through the immediate airport area.
- **Looking-up view** — an altitude-aware sky dome calculated from an approximate
  Riddells Creek viewpoint, with aircraft, stars, planets, the sun, moon, satellites,
  compass directions, and elevation rings in their current positions.

The **Look up / Runway** button switches views immediately. The right-hand panel
shows:

- live aircraft within 25 nautical miles of Riddells Creek;
- callsign or registration, aircraft type, altitude, speed, and distance;
- Riddells Creek temperature, cloud, wind, gusts, humidity, and pressure;
- Melbourne local time and UTC; and
- connection freshness and source status.

Aircraft positions refresh about every three seconds, the clocks tick every second,
and current weather is refreshed every five minutes from 15-minute model conditions.

## TV use

Open the deployed site in the TV's browser with `/?kiosk=1` appended to the URL.
Tap once to request full-screen mode and a screen wake lock. The layout is designed
for a 16:9 landscape display such as an Echo Show 15 or framed touchscreen monitor.

The public display uses only an approximate Riddells Creek suburb centre. It does
not show or store a household name, street address, or house-level coordinate.

## Live data

| Information | Source |
|---|---|
| Aircraft positions | [airplanes.live](https://airplanes.live/) public ADS-B feed |
| Current conditions | [Open-Meteo](https://open-meteo.com/) |
| Satellite elements | [CelesTrak](https://celestrak.org/) |
| Sun, moon, stars and planets | [astronomy-engine](https://github.com/cosinekitty/astronomy) |
| Satellite positions | [satellite.js](https://github.com/shashwatak/satellite-js) |
| Melbourne Airport runways | [OurAirports](https://ourairports.com/) |

## Run locally

Requires Node.js 20 or newer.

```bash
corepack pnpm install
corepack pnpm build
DATA_SOURCE=api corepack pnpm start
```

Then open:

- Display: `http://localhost:3000/?kiosk=1`
- Fixed runway view: `http://localhost:3000/?view=runway`
- Fixed looking-up view: `http://localhost:3000/?view=sky`

For development with hot reload:

```bash
DATA_SOURCE=api corepack pnpm dev
```

## Deploy

The hosted display is a Vite build with small Vercel functions for live aircraft,
weather, and satellite data.

```bash
vercel deploy -y
```

No API keys are required for the public feeds currently used by the display.

## Checks

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Relevant project areas

- `web/src/display/` — canvas renderer, alternating views, and live flight-deck panel.
- `web/src/styles/display.css` — TV layout and visual treatment.
- `api/` — hosted aircraft, weather, and TLE endpoints.
- `shared/` — Melbourne runway data, celestial calculations, and projection math.
- `server/` — optional local server and live WebSocket feed.

## License and attribution

The original Skylight project is by [Chris Paczek](https://github.com/cpaczek).
This fork retains the upstream [MIT license](LICENSE).
