# Brenton's Flight Deck

Brenton's Flight Deck is a live Melbourne airspace and night-sky display made for
an existing TV or touchscreen, an inexpensive ceiling projector, or a brighter
Raspberry Pi-powered premium installation. It combines real-time aircraft around
the viewing area and Melbourne Airport (Tullamarine) with current weather, local
time, and the sky overhead. This is a Melbourne-focused fork of
[cpaczek/skylight](https://github.com/cpaczek/skylight).

### Cost at a glance

| **Option 1 — TV dashboard** | **Option 2 — Overhead projector** | **Option 3 — Premium overhead projector** |
|:---:|:---:|:---:|
| **Free** | **About A$150** | **A$1,800–A$2,000 + curtains** |

<br>

## Live data

| Information | Source |
|---|---|
| Aircraft positions | <img src="docs/source-icons/airplanes-live.png" alt="airplanes.live favicon" width="18"> [airplanes.live](https://airplanes.live/) public ADS-B feed |
| Current conditions | <img src="docs/source-icons/open-meteo.png" alt="Open-Meteo favicon" width="18"> [Open-Meteo](https://open-meteo.com/) |
| Airline SVG catalog | <img src="docs/source-icons/github.png" alt="GitHub favicon" width="18"> [Soaring Symbols](https://github.com/soaring-symbols/soaring-symbols) |
| Satellite elements | <img src="docs/source-icons/celestrak.png" alt="CelesTrak favicon" width="18"> [CelesTrak](https://celestrak.org/) |
| Sun, moon, stars and planets | <img src="docs/source-icons/github.png" alt="GitHub favicon" width="18"> [astronomy-engine](https://github.com/cosinekitty/astronomy) |
| Satellite positions | <img src="docs/source-icons/github.png" alt="GitHub favicon" width="18"> [satellite.js](https://github.com/shashwatak/satellite-js) |
| Melbourne Airport runways | <img src="docs/source-icons/ourairports.png" alt="OurAirports favicon" width="18"> [OurAirports](https://ourairports.com/) |

<br>

## Display options

### Option 1 — TV dashboard (Free)

![Brenton's Flight Deck running as the full interactive TV dashboard](docs/brentons-flight-deck-tv.png)

Use the full 16:9 dashboard on a regular TV, Echo Show 15, or framed touchscreen
at no extra hardware or subscription cost when using a screen and internet
connection you already have. Open it in either of these ways:

- **TV browser:** open the [public Kiosk 1 dashboard](https://skylight-melbourne.vercel.app/?kiosk=1)
  directly in the TV's built-in browser.
- **Screen mirroring:** open the same Kiosk 1 link on a phone, tablet, or computer,
  then mirror or cast that screen to the TV with AirPlay, Google Cast, Miracast,
  or a wired HDMI connection where supported.

Features include a live 70 km runway radar, overhead sky, tap-to-follow aircraft,
current weather, airline logos, and the next five flights. Aircraft positions
refresh about every three seconds, while Runway and Overhead alternate every 45
seconds. Tap **Expand** for fullscreen and a screen wake lock; Kiosk 1 keeps the
cursor visible and includes interactive **Runway**, **Overhead**, and **Follow**
controls.

<br>

### Option 2 — Overhead Projector (About A$150)

![Brenton's Overhead running as the minimal ceiling projector view](docs/brentons-overhead-projector.png)

Open the [public Kiosk 2 projector](https://brentons-overhead.vercel.app) for the
separate ceiling presentation. It shows live aircraft with longer trails, stars,
constellations, the Moon, planets, satellites and basic details for the nearest
flight. There are no dashboard panels or visible cursor. It requests a screen
wake lock immediately and enters fullscreen on its first tap.

#### Example vertical projector

[Kimwood vertical projector — A$145.99 on Amazon Australia](https://www.amazon.com.au/Kimwood-Projector-Bluetooth-Ultra-Projectors/dp/B0G1S78RNM).
This inexpensive rotating-projector style is suited to the ceiling setup;
availability and pricing can change.

<br>

### Option 3 — Overhead Projector Premium

![Premium Brenton's Overhead ceiling installation with a vertical projector and Raspberry Pi](docs/brentons-overhead-premium-mockup.png)

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
| **Estimated total** | Pi setup with the ViewSonic; excludes curtains, optional local receivers, installation labour and internet service | **$1,800–$2,000 + curtains** |

<br>

#### Optional local receivers

| **Local ADS-B — FlightAware Pro Stick Plus** | **Airband audio — XHData D-808** |
|---|---|
| [<img src="docs/flightaware-pro-stick-plus.jpg" alt="FlightAware Pro Stick Plus USB ADS-B receiver" width="100%">](https://core-electronics.com.au/flightaware-pro-stick-plus-usb-sdr-ads-b-receiver.html) | [<img src="docs/xhdata-d808-airband-receiver.jpg" alt="XHData D-808 airband receiver" width="100%">](https://www.tecsunradios.com.au/store/product/xhdata-d-808-lw-mw-sw-fm-airband-receiver/) |
| **[FlightAware Pro Stick Plus — A$98.75](https://core-electronics.com.au/flightaware-pro-stick-plus-usb-sdr-ads-b-receiver.html)**<br>Sends local 1090 MHz aircraft positions to the Pi.<br>Built-in RF amplifier and 1090 MHz filter.<br>Needs a **[1090 MHz antenna — A$14.70](https://core-electronics.com.au/3dbi-ads-b-1090mhz-sma-antenna-w-magnetic-base-1.html)**. | **[XHData D-808 Airband Radio — A$185](https://www.tecsunradios.com.au/store/product/xhdata-d-808-lw-mw-sw-fm-airband-receiver/)**<br>Plays local 118–137 MHz VHF airband audio.<br>Built-in squelch quiets noise between calls.<br>Runs separately while FlightAware handles ADS-B. |

Both are optional, receive-only additions, and the public live feeds continue to
work without them: the FlightAware receiver supplies local aircraft data, while
the D-808 supplies radio audio. [ACMA says](https://www.acma.gov.au/apparatus-licences)
a receiver only needs an apparatus licence when an assigned frequency is required.

<br>

## License and attribution

The original Skylight project is by [Chris Paczek](https://github.com/cpaczek).<br>
This fork retains the upstream [MIT license](LICENSE).<br>
Airline SVGs are from [Soaring Symbols](https://github.com/soaring-symbols/soaring-symbols) by Anh Thang (MIT); airline trademarks remain with their owners.
