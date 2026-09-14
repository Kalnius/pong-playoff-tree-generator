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
- view the bracket as an SVG visualization with connector lines (recommended for clarity)
- view the bracket as traditional round-based cards (alternative)
- live PNG preview that updates as results are entered

## Visual bracket rendering

Two bracket viewing modes available, toggled with buttons:

1. **Bracket view (default)** — an SVG-based tournament bracket with:
   - Cleaner visual layout with connector lines showing match flow
   - Player names and scores displayed in each match box
   - Real-time updates as you enter results
   
2. **Card view** — the traditional round-based card layout with horizontal scrolling

## Seeding model

The app now prefers a **denser paired-group playoff** for even group counts:
- groups are paired as `A vs B`, `C vs D`, and so on
- lower placements (rank `3+`) run through compact qualifier rounds with more matches per round
- qualifier winners are seeded into each pair's `#2` lane (`A2`, `B2`, ...)
- winners of those matches are then seeded into each pair's `#1` lane (`A1`, `B1`, ...)
- lane winners feed a final knockout stage (`Quarterfinals`/`Semifinals`/`Final` depending on group count)

The bracket now also includes a **Third Place Play-off** whenever a semifinal stage exists.

For odd group counts, the app falls back to a seeded knockout format and also adds a third-place match when possible.

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

## Single-file HTML build (Confluence-friendly)

Generate a self-contained HTML file (inline JS/CSS, no external hosting required):

```powershell
npm run build:single
```

Output file:
- `static/playoff-ui/dist/playoff-single-file.html`

This file can be opened directly in a browser or injected into Confluence as a standalone local tool.

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

**Live PNG updates**: The PNG preview updates automatically as results are entered — no manual refresh needed. Every time you enter or change a score, the PNG regenerates to show the current bracket state.

However, on plain GitHub Pages there is **no true live server-hosted PNG endpoint** that can change over time without a backend. For live external display, use the read-only iframe embed link. The PNG is a snapshot export of the current state.

