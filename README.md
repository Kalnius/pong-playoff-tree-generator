# Table Tennis Playoff Form (Static App)

ACCESS VIA: https://kalnius.github.io/pong-playoff-tree-generator/

This project is now a standalone static React app (no Forge runtime).

It lets users:

- enter ranked group standings
- set a separate player count for each group
- generate a playoff tree
- enter winners/scores
- auto-advance winners through rounds
- copy a live share link with the full state encoded in the URL
- download/import JSON backups
- export a PNG snapshot of the current bracket

## Seeding model

The app now prefers a **progressive pair-ladder** model for even group counts:

- groups are paired as `A vs B`, `C vs D`, and so on
- the lower placements from each pair of groups start first
- higher placements from those same groups join in later rounds
- groups may have different player counts; a seed without a counterpart advances
  until the next stage with an available opponent
- if the lower half is too large to feed directly into the next tier, extra merge rounds are inserted before the next higher placements join

Examples:

- `2 groups x 5 players`: `5th vs 5th`, `4th vs 4th`, then winners face `3rd`, then `2nd`, then `1st`, then the pair final
- `2 groups x 7 players`: `7th/6th/5th/4th` start in round 1, then merge rounds reduce them before they climb into the `3rd`, `2nd`, and `1st` players
- `7 players vs 4 players`: unmatched lower seeds from the larger group move
  forward until they reach the next populated stage

For odd group counts, the app falls back to a generic seeded knockout so every configuration still works.

The app can be hosted on GitHub Pages as a standalone static app.

## Prerequisites

- Node.js 20+

## Local development

```powershell
npm install
npm run dev
```

In the Vite development server, MSW intercepts JsonBin reads and saves. Saved
data stays in this browser's local storage across reloads; it is never sent to
JsonBin. To start fresh, clear this site's local storage. Builds and previews do
not enable the mock and use the real JsonBin endpoint.

## Build

```powershell
npm run build
```

Build output is generated in `static/playoff-ui/dist`.

## GitHub Pages hosting

Deploy the contents of `static/playoff-ui/dist` to your GitHub Pages site.

The app now ships with `static/playoff-ui/vite.config.js` configured with a relative `base`, so project-path GitHub Pages deployments work out of the box.

## Persistence and backup

Because GitHub Pages is static hosting, there is no built-in server database.

To avoid losing important playoff data:

- state is stored in a JsonBin bin (loaded once per page session)
- edits are kept in memory and only persisted when you press **Save**
- you can download a compact JSON backup and import it later

## PNG export note

The app can render a **PNG snapshot** of the current bracket for download/copying.

However, on plain GitHub Pages there is **no true live server-hosted PNG endpoint** that can change over time without a backend. The PNG is a snapshot export of the current state.
