# Brenton's Flight Deck

A live flight display for Victoria, adaptable between a regular TV or touchscreen
and a fullscreen ceiling installation using an inexpensive vertical projector at
about the $100 mark. It combines real aircraft positions around the viewing area
and Melbourne Airport with a current sky map, local weather, and clocks.

This is a Melbourne-focused fork of [cpaczek/skylight](https://github.com/cpaczek/skylight).

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

Features include a live 70 km runway radar, overhead sky, tap-to-follow aircraft,
current weather, airline logos and the next five flights. Aircraft update about
every three seconds, with Runway and Overhead views alternating every 45 seconds.

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
separate ceiling presentation. It shows live aircraft with longer trails, stars,
constellations, the Moon, planets, satellites and basic details for the nearest
flight. There are no dashboard panels or visible cursor. It requests a screen
wake lock immediately and enters fullscreen on its first tap.

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
| Vertical projector | [ViewSonic LSD400HD](https://www.viewsonic.com/ap/products/projectors/LSD400HD?app=1) — Full HD laser, 4,000 ANSI lumens, 360-degree projection and 1.48–1.62 standard throw | [$1,499 sale](https://justprojectors.com.au/viewsoniclsd400hd.htm) |
| Blackout curtains | Room-darkening curtains or blinds for stronger daytime contrast | Varies by room |
| Installation | Secure 360-degree-compatible stand or mount and cabling | $100–$250 |
| **Estimated total** | Pi setup with the ViewSonic; excludes curtains, installation labour and internet service | **$1,800–$2,000 + curtains** |

Prices were checked in Australia on 14 July 2026 and will change. The projector
is the main cost; an existing suitable projector can reduce the total
substantially.

#### Installation plan

1. **Measure first.** Choose the ceiling image area and measure the full optical
   path from the projector to that area. The ViewSonic produces a 100-inch image
   at approximately 3.28 m with its 1.48–1.62 throw. Confirm the desired image
   size before fixing a stand or mount.
2. **Aim it upward safely.** The ViewSonic is explicitly rated for 360-degree
   projection, allowing its lens to point directly at the ceiling without a
   mirror. Secure the 3 kg projector with hardware suitable for that orientation
   and keep every intake and exhaust vent clear.
3. **Control the room light.** Fit blackout curtains or blinds where daylight
   reaches the room so the projected aircraft and fine trails remain visible.
4. **Prepare the Pi.** Install Raspberry Pi OS with Desktop on the microSD card,
   connect Wi-Fi or Ethernet, and connect the Pi to the projector over HDMI.
5. **Make it appliance-like.** Configure Chromium to open
   `https://brentons-overhead.vercel.app` in kiosk mode at login, disable screen
   blanking and restart the browser automatically if it exits.
6. **Align and test.** Focus the ceiling image, minimise digital keystone, confirm
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

## License and attribution

The original Skylight project is by [Chris Paczek](https://github.com/cpaczek).
This fork retains the upstream [MIT license](LICENSE).

The bundled airline SVG catalog comes from
[Soaring Symbols](https://github.com/soaring-symbols/soaring-symbols), created by
Anh Thang and distributed under its MIT license. A copy of that license is kept
with the bundled assets at `web/public/airline-logos/LICENSE`. Airline names and
logos remain trademarks of their respective owners.
