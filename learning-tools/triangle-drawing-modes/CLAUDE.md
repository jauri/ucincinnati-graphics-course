# Tool: Triangle drawing modes (triangle-drawing-modes)

An illustration (not a playground: nothing is edited) of six ways to draw
triangles from a buffer in WebGL 2: `drawArrays` and `drawElements`, each
with `TRIANGLES`, `TRIANGLE_STRIP` and `TRIANGLE_FAN`. For each case the
page shows the code, what WebGL draws, and two SVG pictures of the data,
at the same time. History is in `NOTES.md`.

**Main teaching point: a draw call first makes a list of vertex numbers
(`drawArrays` counts up; `drawElements` reads the index buffer), then the
mode groups that list into triangles (3 at a time; each new vertex with
the 2 before it; each new vertex with the first one and the one before
it).** Also: shared corners are stored again with `drawArrays(TRIANGLES)`;
strips need zigzag order; every other strip triangle has its first two
vertices swapped to keep the same winding; with `drawElements` the
vertex-buffer order is free and the index order is what matters.

**Status: built 2026-10-30; checked in headless Chrome, not yet tried by a person.**

## Shapes (shared within each column)
- `TRIANGLES` and `TRIANGLE_STRIP`: a band of 3 triangles, top row
  T0 (-0.8, 0.4), T1 (0, 0.4), T2 (0.8, 0.4); bottom row B0 (-0.4, -0.4),
  B1 (0.4, -0.4). All counterclockwise.
  - arrays TRIANGLES: 9 vertices (T0 B0 T1, T1 B0 B1, T1 B1 T2).
  - arrays STRIP: 5 vertices in zigzag order T0 B0 T1 B1 T2.
  - elements TRIANGLES and STRIP share one vertex buffer in row order
    (0 T0, 1 T1, 2 T2, 3 B0, 4 B1). Indices 0 3 1, 1 3 4, 1 4 2 and
    0 3 1 4 2 make the same three triangles.
- `TRIANGLE_FAN`: center (0, -0.3) and rim (0.8, -0.3), (0.6, 0.3),
  (0, 0.5), (-0.6, 0.3), (-0.8, -0.3); 4 triangles. Arrays: center first.
  Elements: center stored last (vertex 5), indices 5 0 1 2 3 4.

## Design
- Section 1 of `index.js` has one function per case; the code panel
  shows `fn.toString()`, so the code on screen is the code that runs.
  Keep those functions readable as student code: they are the lesson.
- Each case has its own canvas and WebGL 2 context (6 contexts; browsers
  allow about 16).
- `watchCalls` wraps `gl` in a Proxy that records `bufferData` data and
  the draw call's arguments. Section 3 applies the mode rules in JS to
  that record (`vertexList`, `assemble`), and sections 4–6 draw from it.
  Changing a case function updates every picture.
- Strip odd triangles are shown as (i+1, i, i+2); a code comment notes
  that (i, i+2, i+1) is the same triangle and winding.
- Triangle outlines on the result are drawn on a 2D overlay (the shader
  is one flat color); the report line says so.
- Hover: elements tagged `class="hl" data-tris="…"` get `.hot`; things
  you can point at carry `data-tri`. The overlay uses a point-in-triangle
  test.
- Tabs are a 2 × 3 grid; "Show all" stacks all six. The address hash
  (`#elements-strip`) picks the case; section ids are `case-…` so the
  hash doesn't scroll the page. The summary table rows are also tabs.

## Files
- `index.html`: intro, tab grid, summary table, all CSS. Case sections
  are built by `index.js`.
- `index.js`, in 7 sections: the six cases; real WebGL 2 (shaders,
  `watchCalls`, `runCase`); the mode rules; result overlay; clip-space
  SVG; buffer SVG; the page (tabs, hover, summary).

## Testing
- Claude in Chrome was not connected; checked with headless Chrome
  (`--use-angle=swiftshader --enable-unsafe-swiftshader`). Headless
  windows are at least 500 px wide, so narrower screenshots are cropped.
- Checked: all six cases report no WebGL errors; triangle counts; hover
  highlighting in all three views (via a test page in an iframe on a
  temporary local server); layout at 1500 px and 500 px.

## Open issues
- Not tried by a person yet: real hovering, "Show all" scrolling.
- No dark mode (the other tools' style varies; ask if wanted).
