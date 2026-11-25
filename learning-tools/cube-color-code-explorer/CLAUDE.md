# Tool: cube color code explorer (cube-color-code-explorer)

A code explorer (no questions) for two programs of "Ways to Color a
Cube" (`webGL-examples/examples/cube-color-alternatives/`):
- **Tab 5** `5-custom-interpolation.js` (default, `index.html` or
  `?tab=5`): the fragment shader interpolates the colors itself; one rule,
  `uniform int uMode`.
- **Tab 6** `6-per-triangle-rules.js` (`?tab=6`): the same, but even and
  odd triangles get their own rule via `gl_VertexID / 3`.

Left: the whole file of the chosen tab. Right: the same cube with the
same shaders, the rule menu(s), Play/Pause, a time slider (`uTime`), and
a fragment trace. A switch at the top (two plain links) reloads the page
with `?tab=5` / `?tab=6`. History and deferred ideas are in `NOTES.md`.

**Main teaching point:** the fragment shader never sees its triangle's
vertices; it gets interpolated barycentric coordinates (`vBary`), three
`flat` colors (and in tab 6 a `flat` triangle number), and
`interpolate()` turns those into a color.

## Files
- `index.html`: header with the tab switch, code panel (left), canvas +
  overlay canvas, menus, Play/Pause, time slider, trace, "Good to know"
  (right). All CSS. Tab-specific text is filled in by `setUpTab()`.
- `index.js`, 10 sections: reading the tab's source, cube data, matrix
  helpers, real WebGL 2, JS copy of the fragment shader, picking, code
  panel, overlay, trace, state/controls/loop.
- `tab5-source.js`, `tab6-source.js`: GENERATED.
  `const TAB5_SOURCE_LINES` / `TAB6_SOURCE_LINES = [...]`, one string per
  line. Exception to "one index.js": separate data files keep index.js
  readable (like `bricks-texture.js` in the example). Both always load.

## How the two tabs share one program
- `TAB` (5 or 6) comes from `?tab=`; anything but `6` means 5.
- Tab-only lines are `null` in the other tab: `tab6Only(...)` for
  `vsTriangle`, `fsTriangle`, `fsMode`; `tab5Only(...)` for `fsUMode`.
  `LINKED_LINES` entries may name an only-tab (the `triangles` and
  `evenOdd` overlays are tab 6 only).
- `RULE_VARIABLE` is `uMode` (tab 5) or `mode` (tab 6); rule blocks are
  found by `if (<RULE_VARIABLE> == k) {`.
- Tab 5 keeps `state.modeOdd === state.modeEven` (odd menu and label
  hidden, even label reads "Rule (uMode):"), so the trace and picking code
  is shared; `drawCube` sends `uMode` instead of `uModeEven`/`uModeOdd`.
- Trace: tab 5 skips "Vertex shader: which triangle?" and "main(): pick
  the rule"; steps are numbered as they are added.
- `findLine` skips comment-only lines: tab 5's "TO ADD YOUR OWN RULE"
  comment contains `if (uMode == 5) { ... }`, which once cut rule 4's
  block short.

## IMPORTANT: keeping in sync with tabs 5 and 6
- The page compiles the shaders it extracts from the source lines (text
  between `const vertexShaderSource =` … `` `; ``), so the drawn cube
  always matches the shown code.
- Line numbers are never hard-coded: `findLine(snippet)` searches the
  text. A missing snippet logs `Snippet not found in tab N source:`.
- Copies that must follow the tabs by hand: section 2 data
  (`cubeVertices`, `BARY_COORDS`, the 18-float loop), section 3 matrices,
  camera (`EYE`, 45°, 0.1/100), `SPIN_SPEED`, lighting in `renderTrace`,
  `RULE_NAMES` and the menu options, and `interpolateJS()` (one case per
  GLSL rule, with the same constants and the snippets it points at). Tabs
  5 and 6 share all of these (the example's CLAUDE.md keeps them in sync).
- After any change to tab 5 or 6, regenerate from the repo root (N = 5
  or 6, FILE = `5-custom-interpolation` or `6-per-triangle-rules`):
  ```sh
  N=6; FILE=6-per-triangle-rules
  node -e '
  const fs = require("fs");
  const [src, dst, n] = process.argv.slice(1);
  const lines = fs.readFileSync(src, "utf8").replace(/\n$/, "").split("\n");
  const out = ["// GENERATED FILE - do not edit by hand.",
    "// A copy of " + src + ",",
    "// one string per line, so the explorer can show it and compile its shaders",
    "// without loading another file (browsers block that on file://).",
    "// To refresh it after Tab " + n + " changes, see CLAUDE.md in this folder.",
    "const TAB" + n + "_SOURCE_LINES = [", ...lines.map(l => "  " + JSON.stringify(l) + ","), "];", ""];
  fs.writeFileSync(dst, out.join("\n"));
  ' webGL-examples/examples/cube-color-alternatives/$FILE.js learning-tools/cube-color-code-explorer/tab$N-source.js $N
  ```
  then load the page for that tab, check the console for "Snippet not
  found", and rerun the trace check below. If a rule changed, update
  `interpolateJS`.

## Behavior details
- Code panel: header comment and sections 0, 3, 4, 5 start folded;
  1 (shaders) and 2 (buffer) open. Comments dimmed (text after the first
  `//`). Linked lines (`LINKED_LINES`) are underlined with "◀ show on
  cube"; clicking toggles an overlay and tints all lines of that overlay.
- Overlays: `triangles` (tab 6: numbers on front faces + the focus
  triangle's 3 vertex IDs), `evenOdd` (tab 6: even solid white, odd dashed
  yellow, with the rule number), `bary` and `colors` (both tabs: focus
  triangle's three vertices). Focus triangle = the traced fragment's,
  else the biggest front-facing.
- Picking: JS projects all 36 vertices, tests the pixel center against
  front-facing triangles (cube is convex), perspective-corrects the
  weights: λi = (si / wi) / Σ(sj / wj).
- Clicking the cube pauses and picks a pixel; while paused, menus and the
  slider re-trace the same pixel. Play drops the pick. Time wraps at 72 s
  (whole cycles of rules 5–7; the angle jumps there). The tabs themselves
  never wrap. Switching tabs reloads the page (pick and time reset).
- Canvas uses devicePixelRatio and `preserveDrawingBuffer: true`
  (for `readPixels`); the tabs do neither.
- Trace rows have "line N" buttons (unfold + scroll + flash). Lines that
  ran get the yellow "ran" bar. For rule 1 only the deciding `return` line
  is marked, not the earlier `if` lines that were checked and failed.

## Testing
- Verified 2026-11-24 in Chrome (served locally), both tabs: no console
  warnings or errors; every trace step's line lies inside its rule block;
  24×24 pixel grid × 4 times × 8 rules (tab 6: even/odd rule pairs): the
  JS trace matches `readPixels` within 3/255 everywhere except pixels
  within 0.5 px of a triangle edge (the GPU gives those to the neighbor).
- Check: in the console, loop over pixels with `pickFragment` +
  `renderTrace` and read "largest difference" from `traceBody`.

## Open issues
- Not yet tried by a person.
- On short screens the trace starts below the cube; the right column
  scrolls.
