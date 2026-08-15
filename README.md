# Sweepy

Household chore app. Lives at [sweepy.jassie.us](https://sweepy.jassie.us).

## Local

```bash
npm install
npx prisma generate
npm run dev
```

Uses `prisma/dev.db`. Create a login with `node scripts/set-password.js`.

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
