# Tool: cube color code walkthrough (cube-color-code-walkthrough)

A guided, read-only walkthrough (no questions) of two programs of "Ways
to Color a Cube" (`webGL-examples/examples/cube-color-alternatives/`):
- **Tab 5** `5-custom-interpolation.js` (default, or `?tab=5`): 20 steps.
- **Tab 6** `6-per-triangle-rules.js` (`?tab=6`): 22 steps (two extra:
  `vs-triangle` after `vs-main`, `fs-even-odd` after `rules5-7`).

Each step shows one function or action of the file. Everything else is
folded, so students aren't faced with the whole file. Next to the code:
a short explanation, a picture made for that step, and a live cube that
runs the tab's real shaders, set up for the step. Sibling tool: the
`cube-color-code-explorer` (whole file, fragment trace), linked from the
header. History is in `NOTES.md`.

## Files
- `index.html`: header (tab switch, section list with step dots), code
  panel (left), step title / picker / text / figure / live cube / Prev
  and Next (right). All CSS.
- `index.js`, 10 sections: reading the source, the steps, picture
  helpers, cube data, matrix helpers, real WebGL 2, overlay, code panel,
  navigation, state + loop.
- `tab5-source.js`, `tab6-source.js`: GENERATED copies of the two tabs
  (`const TAB5_SOURCE_LINES` / `TAB6_SOURCE_LINES`, one string per line).
  Exception to "one index.js", as in the explorer.

## The steps (`ALL_STEPS` in section 2)
- One object per step: `id`, `section` (file section 0–5), `only: 6` for
  tab-6-only steps, `title`, `ranges`, `text`, `figure`, `cube`, and
  optionally `within` ('vs'/'fs'), `picker`, `drawFigure`.
- `ranges(choice)` names lines by SNIPPETS, never line numbers (see
  `resolveRanges`): `{from}`, `{from, to}`, `{from, lines}`,
  `{from, before}`, `{from, toEnd}`, `{block}` (a line opening `{`
  through its matching `}`). Each range is searched after the start of
  the previous one; `within` limits the search to one shader.
  `findLine` skips comment-only lines (tab 5's comments contain
  `if (uMode == 5) { ... }`).
- Steps with a `picker` (`rules1-4`, `rules5-7`) show one rule's `if`
  block; the choice is kept per step in `state.pick`.
- The tab switch links to the same step by `id`; a tab-6-only step falls
  back to the step before it (`stepInOtherTab`).
- Tab-specific wording uses `tabText(t5, t6)`.

## Code panel rules
- The step's lines: highlighted. Gaps inside the step's section: one
  "⋯ lines a–b" row each (click to peek, dimmed). Other sections: one
  fold row each (click to peek). Peeks reset on every step change.
- Comment-only lines are hidden unless "Show the file's comments" is
  checked (a gap of only comments then disappears); end-of-line comments
  stay, dimmed. Runs of blank lines show as one.
- Tab 6: lines whose code (comments ignored) is not in tab 5 get an
  orange bar, and "changed in tab 6" on the first line of each run
  (`CHANGED_LINES`).

## Pictures
- Inline SVG from helpers (`svg`, `rect`, `txt`, `arrow`, `line`,
  `boxText`, `swatchRect`). `txt` uses `white-space:pre` so padded
  columns line up.
- Colored triangles are painted pixel by pixel with `interpolateColor()`,
  a JS copy of the shader's `interpolate()` (same constants), and put in
  the SVG as an `<image>` (`triangleImage`). The animated rules (5–7)
  repaint a `<canvas>` each frame with the cube's `uTime`.
- Attribute colors are consistent: position blue, normal teal, aBary
  yellow, colors purple, uniforms orange.

## Live cube
- Compiles the shaders extracted from the source lines, so it always
  matches the shown code. `cube(choice)` returns `{ rule, ruleOdd, spin,
  overlay, blank, note }`. `spin: false` pauses at `POSE_TIME` (2.6 s).
  The Play/Pause button overrides that until the next step.
- Overlays: `bary`, `colors`, `corners`, `triangles` (tab 6), `evenOdd`
  (tab 6), `outlines`. Focus triangle = biggest front-facing one.

## IMPORTANT: keeping in sync with tabs 5 and 6
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
    "// one string per line, so the walkthrough can show it and compile its shaders",
    "// without loading another file (browsers block that on file://).",
    "// To refresh it after Tab " + n + " changes, see CLAUDE.md in this folder.",
    "const TAB" + n + "_SOURCE_LINES = [", ...lines.map(l => "  " + JSON.stringify(l) + ","), "];", ""];
  fs.writeFileSync(dst, out.join("\n"));
  ' webGL-examples/examples/cube-color-alternatives/$FILE.js learning-tools/cube-color-code-walkthrough/tab$N-source.js $N
  ```
  Then load each tab and check the console for "Snippet not found".
- Copies that must follow the tabs by hand: section 4 data, section 5
  matrices, camera and `SPIN_SPEED`, `interpolateColor()` and
  `RULE_TEXT` (rule constants), the lighting numbers in `figLighting`,
  and the step texts that quote code.

## Testing
- Verified 2026-11-25 in Chrome (served locally), both tabs: every
  step's snippets found (no warnings), every step and picker choice
  rendered, the tab switch keeps the step, the arrow keys work after
  clicking the comments checkbox, no console errors.
- Quick check in the console: loop over `STEPS`, set `state.step`, call
  `currentRanges()` and watch for warnings.

## Open issues
- Not yet tried by a person.
- On a laptop screen the live cube sits below the picture; the right
  column scrolls.
