# Sweepy

Household chore app. Lives at [sweepy.jassie.us](https://sweepy.jassie.us).

## Local

```bash
npm install
npx prisma generate
npm run dev
```

Uses the same Supabase database as production. Create a login with `node scripts/set-password.js` only if you need a new person.

## Seed rooms and tasks (Pi)

The starter catalog lives in `scripts/starter-catalog.json` (rooms, chores, difficulty, how often, and a 1–3 dirtiness). It does **not** run on deploy. When you want a fresh set of defaults:

```bash
docker exec -it sweepy node scripts/seed.js
```

If the database already has rooms or history, it asks before wiping them. After that you can add, edit, or delete anything in the app.

Users are separate:

```bash
docker exec -it sweepy node scripts/set-password.js
```

## Home Assistant

One house token in the Pi `.env` (see `example.env`):

```
HA_URL=http://host.docker.internal:8123
HA_TOKEN=...
```

Notify entities (`notify.pixel` or `notify.mobile_app_pixel`) are set on each person in the app. Sweepy listens on the HA websocket for Done / Tomorrow / Delay — no automation required. `HA_URL` and `HA_TOKEN` are read from the process environment when the container starts (Docker `env_file`), not baked into the image.

`/api/ha-status` sets `listening` only after Home Assistant acknowledges the `mobile_app_notification_action` subscription. If that stays false, `listenError` says why (missing token, auth rejected, heartbeat timeout, subscription not acknowledged). The same line is on Settings. A dropped socket reconnects on its own.

### MQTT

Chore sensors use the same Mosquitto as Zigbee. From the Sweepy container:

```
MQTT_URL=mqtt://host.docker.internal:1883
```

`MQTT_URL` is required. These are optional:

```
MQTT_USER=
MQTT_PASSWORD=
MQTT_DISCOVERY_PREFIX=homeassistant
MQTT_BASE=sweepy
```

Leave the user and password unset when the broker is anonymous. The discovery prefix defaults to `homeassistant` and the topic base to `sweepy`. `/api/ha-status` → `mqtt.configured` is true only when `MQTT_URL` is present in that environment; `mqtt.missing` lists `MQTT_URL` when it is not. Devices already retained in Home Assistant stay there until the broker drops them, even if this container is not connected. Put `MQTT_URL` on the NAS only so a laptop does not double-publish.

Each room becomes an HA device with a cleanliness % (the Rooms bar) and a dirt sensor per chore. Completing a chore still publishes `sweepy/task/<id>/event` with payload `completed`, and `sweepy/event/task_completed`.

Each chore has its own device trigger on the room: type `action`, subtype `completed_<chore id>`. Older discovery used subtype `completed` for every chore in the room, which Home Assistant rejected as a conflict (`cannot set up trigger`). The next sync clears those retained configs. Automations that used the room device trigger "completed" need to be pointed at the specific chore. Automations that subscribe to `sweepy/task/<id>/event` keep working.
