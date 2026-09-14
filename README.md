# Table Tennis Playoff Form (Static App)

This project is now a standalone static React app (no Forge runtime).

It lets users:
- enter ranked group standings
- generate a playoff tree
- enter winners/scores
- auto-advance winners through rounds
- copy a live share link with the full state encoded in the URL
- copy a read-only iframe embed link for external pages
- download/import JSON backups
- export a PNG snapshot of the current bracket

## Seeding model

The app now prefers a **progressive pair-ladder** model for even group counts:
- groups are paired as `A vs B`, `C vs D`, and so on
- the lower placements from each pair of groups start first
- higher placements from those same groups join in later rounds
- if the lower half is too large to feed directly into the next tier, extra merge rounds are inserted before the next higher placements join

Examples:
- `2 groups x 5 players`: `5th vs 5th`, `4th vs 4th`, then winners face `3rd`, then `2nd`, then `1st`, then the pair final
- `2 groups x 7 players`: `7th/6th/5th/4th` start in round 1, then merge rounds reduce them before they climb into the `3rd`, `2nd`, and `1st` players

For odd group counts, the app falls back to a generic seeded knockout so every configuration still works.

The app can be hosted on GitHub Pages and embedded in another page via an iframe.

## Prerequisites
- Node.js 20+

## Local development

```powershell
npm install
npm --prefix static/playoff-ui install
npm run dev
```

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
- the app automatically mirrors the full state into the page URL hash
- the app also stores a local browser copy in `localStorage`
- you can download a compact JSON backup and import it later

The **share link / embed link** is the most redeploy-safe option because the important state travels with the URL itself.

## Embedding + reading form inputs from host page

The app posts state updates to its parent window:
- message type: `playoff:state`
- payload shape: `{ groupCount, playersPerGroup, groups, tournament }`

The host page can request state:
- send message type: `playoff:request-state`

The host page can set state:
- send message type: `playoff:set-state`
- payload shape: same as above

Example host page script:

```html
<iframe id="playoff-frame" src="https://YOUR_GH_PAGES_URL/index.html"></iframe>
<script>
  const frame = document.getElementById("playoff-frame");

  window.addEventListener("message", (event) => {
	const msg = event.data;
	if (!msg || msg.type !== "playoff:state") return;
	console.log("Playoff state", msg.payload);
  });

  frame.addEventListener("load", () => {
	frame.contentWindow.postMessage({ type: "playoff:request-state" }, "*");
  });
</script>
```

For a complete working host example, see:
- `static/playoff-ui/public/confluence-embed-example.html`

## PNG export note

The app can render a **PNG snapshot** of the current bracket for download/copying.

However, on plain GitHub Pages there is **no true live server-hosted PNG endpoint** that can change over time without a backend. For live external display, use the read-only iframe embed link. The PNG is a snapshot export of the current state.

