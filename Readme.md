# AC Infinity with Meross Humidifier via Homebridge

This guide explains how to bridge an AC Infinity grow tent controller and a Meross humidifier through Homebridge so humidity changes from AC Infinity can switch the humidifier on or off.

## Overview

- Homebridge runs in Docker.
- The `homebridge-acinfinity` plugin reads AC Infinity inputs (humidity, temp, device states).
- The `homebridge-meross` plugin exposes the Meross humidifier to HomeKit/Homebridge.
- Homebridge automations tie them together so when AC Infinity detects low humidity the Meross humidifier powers on, and it turns off after the target humidity is reached.

## Prerequisites

- Docker and Docker Compose installed on the host.
- Network access for Homebridge to reach both AC Infinity and Meross devices on the same LAN.
- HomeKit/Homebridge mobile app (e.g., Home+ or Apple Home) to configure automations.

## 1. Run Homebridge in Docker

Create a `docker-compose.yml` next to this README:

```yaml
version: "3"
services:
  homebridge:
    image: homebridge/homebridge:latest
    restart: unless-stopped
    network_mode: host # exposes mDNS/Bonjour cleanly
    volumes:
      - ./homebridge:/homebridge
    environment:
      - TZ=UTC
      - PGID=1000
      - PUID=1000
```

Start the container:

```bash
docker compose up -d
```

Access the UI at `http://<host-ip>:8581` (default credentials: admin/homebridge) and change the password after first login. Backup configs with `docker compose down` and the `./homebridge` volume.

## 2. Install required plugins

From the Homebridge UI:
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

## 6. Troubleshooting

- Confirm both plugins show accessories in the Homebridge UI under **Accessories**.
- If AC Infinity data stops updating, regenerate its token by re-saving credentials and restarting.
- For Meross, ensure UDP/mDNS is not blocked; host networking minimizes issues.
- Check container logs with `docker compose logs -f homebridge` for plugin errors.

## 7. Security and maintenance

- Change default UI password immediately.
- Keep the container updated: `docker compose pull && docker compose up -d`.
- Backup the `./homebridge` directory regularly; it contains configs and cached accessories.

This setup lets AC Infinity readings drive the Meross humidifier automatically through Homebridge automations, keeping your tent at the desired humidity.
