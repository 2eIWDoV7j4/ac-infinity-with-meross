# AC Infinity with Meross Humidifier via Homebridge

This guide explains how to bridge an AC Infinity grow tent controller and a Meross humidifier through Homebridge so humidity changes from AC Infinity can switch the humidifier on or off. A small TypeScript helper in this repo lets you dry-run the control logic with logs before wiring everything together. The repository now includes a background automation service that polls Homebridge accessories and toggles the Meross humidifier automatically.

## Overview

- Homebridge runs in Docker.
- The `homebridge-acinfinity` plugin reads AC Infinity inputs (humidity, temp, device states).
- The `homebridge-meross` plugin exposes the Meross humidifier to HomeKit/Homebridge.
- Homebridge automations tie them together so when AC Infinity detects low humidity the Meross humidifier powers on, and it turns off after the target humidity is reached.
- The included TypeScript dry-run simulates these automations with typed outputs and logs.

## Prerequisites

- Docker and Docker Compose installed on the host.
- Network access for Homebridge to reach both AC Infinity and Meross devices on the same LAN.
- HomeKit/Homebridge mobile app (e.g., Home+ or Apple Home) to configure automations.
- Node.js 20+ to run the dry-run harness.

## 1. Run Homebridge + automation in Docker

Use the included `docker-compose.yml` to run both Homebridge and the background automation service side by side. The Homebridge
container builds from `Dockerfile.homebridge`, which pre-installs both required plugins (`homebridge-acinfinity` and `homebridge-
meross`) so they are available immediately after first boot:

```bash
docker compose up -d --build
```

- Homebridge uses host networking for reliable mDNS/Bonjour discovery and stores data in `./homebridge`.
- The automation container shares the host network so it can reach Homebridge at `http://localhost:8581`.
- Both containers restart automatically unless stopped.
- Rebuild (`docker compose build homebridge`) if you need newer plugin versions; the build step runs `npm install -g homebridge-
  acinfinity homebridge-meross` inside the Homebridge image.

Access the UI at `http://<host-ip>:8581` (default credentials: admin/homebridge) and change the password after first login. Backup configs with `docker compose down` and the `./homebridge` volume.

## 2. Install required plugins

The Docker build pre-installs the plugins. After Homebridge starts, open the UI and confirm both show as installed under **Plug
ins**. If you prefer to manage plugins manually, you can still install/update them from the UI:
1. Go to **Plugins**.
2. Install [`homebridge-acinfinity`](https://github.com/keithah/homebridge-acinfinity).
3. Install [`homebridge-meross`](https://github.com/homebridge-plugins/homebridge-meross).

## 3. Configure AC Infinity plugin

Use the UI config editor or edit `./homebridge/config.json` directly. Minimal example:

```json
{
  "platforms": [
    {
      "platform": "AcInfinity",
      "email": "YOUR_AC_INFINITY_EMAIL",
      "password": "YOUR_AC_INFINITY_PASSWORD",
      "pollingInterval": 60
    }
  ]
}
```

Notes:
- Use a dedicated AC Infinity account for stability.
- `pollingInterval` controls how often sensor values refresh (seconds).
- After saving, restart Homebridge from the UI.

## 4. Configure Meross plugin

Add a new platform entry for Meross in the same `config.json`:

```json
{
  "platforms": [
    {
      "platform": "AcInfinity",
      "email": "YOUR_AC_INFINITY_EMAIL",
      "password": "YOUR_AC_INFINITY_PASSWORD"
    },
    {
      "platform": "Meross",
      "name": "Meross",
      "username": "YOUR_MEROSS_EMAIL",
      "password": "YOUR_MEROSS_PASSWORD",
      "messageRateLimit": 10
    }
  ]
}
```

Notes:
- Ensure the Meross humidifier is registered in the Meross app first.
- `messageRateLimit` prevents command floods; increase only if updates are delayed.

## 5. Create automations (Home app/Home+)

Once both accessories appear:

- **Trigger:** AC Infinity humidity sensor reports below your threshold.
- **Action:** Set Meross humidifier power to **On** (optionally set target humidity).
- **Trigger 2:** AC Infinity humidity sensor reaches or exceeds target.
- **Action 2:** Set Meross humidifier power to **Off**.

Tips:
- Use a small hysteresis (e.g., ON when < 45%, OFF when >= 50%) to avoid rapid toggling.
- If available, expose the humidifier’s built-in target humidity via `homebridge-meross` and align it with the AC Infinity thresholds.

## 6. Dry-run the automation logic with TypeScript

Use the included Node.js scripts to see how humidity readings map to on/off actions before wiring automations:

```bash
npm run dry-run
```

- The script runs a simulated humidity timeline (10 readings spaced five minutes apart) and logs the resulting actions.
- Adjust the target and tolerance inside `src/dryRun.ts` or extend it with your own sensor samples.

## Required environment variables

Set these before running the dry-run so logs show the identifiers you expect. They are also used by the automation service (with defaults for optional entries):

- `HOMEBRIDGE_HOST`: Hostname or IP for the Homebridge UI/API.
- `HOMEBRIDGE_PORT`: Port number for Homebridge (defaults to 8581).
- `HOMEBRIDGE_USERNAME`: Homebridge UI username.
- `HOMEBRIDGE_PASSWORD`: Homebridge UI password.
- `MEROSS_DEVICE_ID`: Device UUID for the Meross humidifier (optional if you provide `MEROSS_ACCESSORY_NAME`).
- `MEROSS_ACCESSORY_NAME`: Display name of the Meross humidifier in Homebridge.
- `AC_INFINITY_CONTROLLER_ID`: Identifier for the AC Infinity controller reporting humidity (optional if you provide `AC_INFINITY_ACCESSORY_NAME`).
- `AC_INFINITY_ACCESSORY_NAME`: Display name of the AC Infinity accessory in Homebridge.
- `TARGET_HUMIDITY`: Desired humidity percentage (default 62).
- `HUMIDITY_TOLERANCE`: Swing around the target before toggling (default 3).
- `POLL_INTERVAL_SECONDS`: How often to poll humidity (default 60 seconds).

None of these are required to execute the simulation—they are logged and masked for awareness and future wiring. The automation service requires the Homebridge host/port/credentials.

## 7. Run the background automation service

The automation service polls Homebridge, reads the AC Infinity humidity characteristic, and toggles the Meross humidifier using the thresholds you configure. It runs forever inside the `automation` container.

1. Create a `.env` file next to `docker-compose.yml`:

```env
# Homebridge connection
HOMEBRIDGE_HOST=127.0.0.1
HOMEBRIDGE_PORT=8581
HOMEBRIDGE_USERNAME=admin
HOMEBRIDGE_PASSWORD=homebridge

# Optional identifiers to disambiguate devices
AC_INFINITY_ACCESSORY_NAME=Grow Tent Controller
MEROSS_ACCESSORY_NAME=Grow Tent Humidifier

# Automation tuning
TARGET_HUMIDITY=62
HUMIDITY_TOLERANCE=3
POLL_INTERVAL_SECONDS=60
```

2. Build and start everything:

```bash
docker compose up -d --build
```

3. View automation logs:

```bash
docker compose logs -f automation
```

The service logs each humidity reading and decision. It re-authenticates with Homebridge automatically if the UI token expires.

## 8. Troubleshooting

- Confirm both plugins show accessories in the Homebridge UI under **Accessories**.
- If AC Infinity data stops updating, regenerate its token by re-saving credentials and restarting.
- For Meross, ensure UDP/mDNS is not blocked; host networking minimizes issues.
- Check container logs with `docker compose logs -f homebridge` for plugin errors. For automation issues, use `docker compose logs -f automation`.

## 9. Security and maintenance

- Change default UI password immediately.
- Keep the container updated: `docker compose pull && docker compose up -d`.
- Backup the `./homebridge` directory regularly; it contains configs and cached accessories.

This setup lets AC Infinity readings drive the Meross humidifier automatically through Homebridge automations, keeping your tent at the desired humidity. The TypeScript dry-run gives you a transparent preview of how the control logic responds to changing humidity values.
