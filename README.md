# Brenton's Flight Deck

A live flight display for Victoria, adaptable between a regular TV or touchscreen
and a fullscreen ceiling installation using an inexpensive vertical projector at
about the $100 mark. It combines real aircraft positions around the viewing area
and Melbourne Airport with a current sky map, local weather, and clocks.

This is a Melbourne-focused fork of [cpaczek/skylight](https://github.com/cpaczek/skylight).

## The display

Brenton's Flight Deck alternates every 45 seconds between two wide live views:

- **Runway view** — a home-centred 70 km radar/map with live aircraft positions,
  compass rings, trails, and Melbourne Airport (MEL/YMML) runway context in its
  real geographic direction.
- **Overhead view** — an altitude-aware sky dome calculated from an approximate
  viewpoint in Victoria, with aircraft, stars, planets, the sun, moon, satellites,
  compass directions, and elevation rings in their current positions.
- **Follow view** — select a live aircraft on the main field or in the lower strip
  to centre an 18 km moving view on that aircraft until **Stop following** is pressed.

The large **Runway / Overhead / Follow** touch control switches views immediately,
the cursor remains visible in Kiosk 1, and the **Expand** button takes the display
fullscreen. The screen is divided into:

- a full-width header with Melbourne local time and live status;
- a large live radar or sky view across the left side;
- a current-weather card above the aircraft card on the right, showing details only
  when supplied by the live feeds; and
- a lower strip with the next five aircraft by distance. Each tile is a button
  that centres and follows that aircraft while opening its details in the right rail.

Airline SVGs are matched from the verified three-letter operator prefix in the
aircraft callsign. If a callsign has no confident match, the display leaves the
logo out rather than guessing.

When no aircraft is close, the side card switches to a quiet-sky state with the
next calculated ISS pass while the looking-up view continues to show current
celestial positions.

Aircraft positions refresh about every three seconds, the clocks tick every second,
and current weather is refreshed every five minutes from 15-minute model conditions.

## Display options

### Option 1 — TV dashboard

![Brenton's Flight Deck running as the full interactive TV dashboard](docs/brentons-flight-deck-tv.png)

Use the full 16:9 dashboard on a regular TV, Echo Show 15, or framed touchscreen
in either of these ways:

- **TV browser:** open the [public Kiosk 1 dashboard](https://skylight-melbourne.vercel.app/?kiosk=1)
  directly in the TV's built-in browser.
- **Screen mirroring:** open the same Kiosk 1 link on a phone, tablet, or computer,
  then mirror or cast that screen to the TV with AirPlay, Google Cast, Miracast,
  or a wired HDMI connection where supported.

Tap **Expand** after opening the dashboard to request fullscreen mode and a screen
wake lock. Kiosk 1 keeps the cursor visible and provides the interactive **Runway**,
**Overhead**, and **Follow** controls.

The airline logo SVGs shown in the dashboard are provided by
[Soaring Symbols](https://github.com/soaring-symbols/soaring-symbols), created by
Anh Thang and distributed under the MIT license. Airline names and logos remain
trademarks of their respective owners.

### Option 2 — Overhead Projector

![Brenton's Overhead running as the minimal ceiling projector view](docs/brentons-overhead-projector.png)

Open the [public Kiosk 2 projector](https://brentons-overhead.vercel.app) for the
separate ceiling presentation. It keeps only the full-screen overhead aircraft
field, longer-lived trails, stars, constellation lines, the Moon, planets and
satellites; the nearest aircraft's callsign, type, altitude, and speed remain
visible beside it. There are no dashboard panels or visible cursor.

Kiosk 2 requests a screen wake lock immediately and enters fullscreen on its
first pointer gesture. A deployment built with `VITE_DEFAULT_KIOSK=2` opens this
projector presentation by default, which is how the separate projector website
is published.

#### Example vertical projector

[![Kimwood vertical projector showing ceiling-scale projection sizes](docs/kimwood-projector-example.png)](https://www.amazon.com.au/Kimwood-Projector-Bluetooth-Ultra-Projectors/dp/B0G1S78RNM)

[View the Kimwood projector on Amazon Australia](https://www.amazon.com.au/Kimwood-Projector-Bluetooth-Ultra-Projectors/dp/B0G1S78RNM).
This is an example of the inexpensive rotating-projector style suited to the
ceiling setup; availability and pricing can change.

### Option 3 — Overhead Projector Premium

For a brighter, more permanent ceiling installation, use a Raspberry Pi as the
dedicated player and a Full HD standard-throw projector. The Pi boots directly
into Kiosk 2, so the projector only needs to provide a reliable HDMI image.

#### Suggested equipment

| Part | Suggested choice | Estimated cost (AUD) |
|---|---|---:|
| Player | [Raspberry Pi 4 Model B, 4 GB](https://core-electronics.com.au/raspberry-pi-4-model-b-4gb.html) | $163 |
| Pi essentials | Official power supply, case, 32 GB microSD card and micro-HDMI cable | $50–$80 |
| Brighter projector | [Epson CO-FH02](https://www.epson.com.au/products/projectors-for-home/home-theatre/CO-FH02) — Full HD, 3,000-lumen, 1.19–1.61 standard throw | $1,099 |
| Installation | Secure mount or shelf, cabling and an optional first-surface mirror | $100–$250 |
| **Estimated total** | Excluding installation labour and internet service | **$1,400–$1,600** |

Prices were checked in Australia on 14 July 2026 and will change. The projector
is the main cost; an existing suitable projector can reduce the total
substantially.

#### Installation plan

1. **Measure first.** Choose the ceiling image area and measure the full optical
   path from the projector to that area. The CO-FH02 produces a 60-inch image at
   approximately 1.58 m; use Epson's distance calculator before fixing a mount.
2. **Plan the upward image safely.** Keep the projector in an orientation allowed
   by its manufacturer, leave its vents clear and use a properly secured mount
   or shelf. If direct lens-up operation is not supported, keep it horizontal
   and use a 45-degree first-surface mirror to turn the image onto the ceiling.
3. **Prepare the Pi.** Install Raspberry Pi OS with Desktop on the microSD card,
   connect Wi-Fi or Ethernet, and connect the Pi to the projector over HDMI.
4. **Make it appliance-like.** Configure Chromium to open
   `https://brentons-overhead.vercel.app` in kiosk mode at login, disable screen
   blanking and restart the browser automatically if it exits.
5. **Align and test.** Focus the ceiling image, minimise digital keystone, confirm
   the Kiosk 2 flight feed updates, and run the complete system for several hours
   while checking temperature, ventilation and network recovery.

Both public displays use only an approximate viewpoint in Victoria. They do not
show or store a household name, street address, or house-level coordinate.

## Live data

| Information | Source |
|---|---|
| Aircraft positions | [airplanes.live](https://airplanes.live/) public ADS-B feed |
| Current conditions | [Open-Meteo](https://open-meteo.com/) |
| Airline SVG catalog | [Soaring Symbols](https://github.com/soaring-symbols/soaring-symbols) |
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
- Minimal projector: `http://localhost:3000/?kiosk=2`
- Fixed runway view: `http://localhost:3000/?view=runway`
- Fixed overhead view: `http://localhost:3000/?view=overhead`

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

The bundled airline SVG catalog comes from
[Soaring Symbols](https://github.com/soaring-symbols/soaring-symbols), created by
Anh Thang and distributed under its MIT license. A copy of that license is kept
with the bundled assets at `web/public/airline-logos/LICENSE`. Airline names and
logos remain trademarks of their respective owners.
