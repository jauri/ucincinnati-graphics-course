# Cube color code explorer: notes

## 2026-11-24: built

Request: turn cube-color-alternatives into a learning activity, focused
on custom interpolation (tab 5) and per-triangle rules (tab 6), as a code
explorer with no questions.

Decisions, asked in a dialog:
- A new learning tool, not tab 8 of the example (keeps the example's
  one-idea-per-diff pattern and "of 7" headers).
- Layout: code left, cube + trace right.
- Code shown: the whole tab 6 file (sections fold).

Implementation choices:
- The tab 6 text lives in a generated `tab6-source.js`, because `fetch`
  is blocked on `file://`. The page compiles the shaders extracted from
  that text, so what students read is what runs.
- Hybrid as in the vertex-ID playground: a JS copy of `interpolate()`
  explains the fragment, and `readPixels` confirms it.
- Removed after the first browser check: a label in the middle of the
  focus triangle in the colors overlay ("every vertex: C0, C1, C2 = …")
  was wider than the canvas; the note under the cube says it instead.

## 2026-11-24: tab 5 added

Request: the same explorer for `5-custom-interpolation.js`. Decision
(dialog): a "Tab 5 | Tab 6" switch inside this tool rather than a
separate folder or second page, so there is one program and one link.
Tab 5 is the default (it comes first in the series). Tab 5 hides the
second menu, the two tab-6-only overlays, and the two tab-6-only trace
steps.

Bug found while testing: tab 5's "TO ADD YOUR OWN RULE" comment contains
`if (uMode == 5) { ... }`, which `findLine` matched before the real rule
5, so rule 4's block ended early and its trace rows had no line links.
Fixed by skipping comment-only lines in `findLine`.

## Deferred extras (the instructor will consider them later)
Offered in the design dialog, answered "save these extras for later":
- **Constant sliders in the code:** the numbers in the rules (power 4,
  steps 4, edge width 0.02, rings 4) become sliders inside the listing;
  the shader recompiles live.
- **Single-triangle 2D view:** one triangle drawn large with the chosen
  rule's regions (nearest-vertex areas, bands, edge strip) and the picked
  point.
- **Split options beyond even/odd:** by face (`vTriangle / 2`), first vs
  second half, etc.
- **Vertex data per pixel:** the picked triangle's 3 vertices × 18 floats
  (position, normal, aBary, aColor0–2) in a table.
