# Tool: Cutting a Bézier curve in two (bezier-subdivision-guided)

A guided activity in which students discover recursive subdivision of a
cubic Bézier curve (de Casteljau's algorithm at t = ½) by doing each step
themselves. History is in `NOTES.md`.

**Main teaching point: a Bézier curve cut at t is two Bézier curves, whose
control points are the edges of the de Casteljau triangle; repeating this
until a stopping rule is met is a recursive drawing algorithm.**

## Stages
1. Choose where to cut. Any t works (students must know this); they settle
   on ½. Equal-length question with an illustration (ticks
   at t = 0, 0.1, …, the lengths 276 and 410, the halfway-by-length point,
   draggable control points).
2. Each control-polygon segment is cut at its midpoint; the midpoint
   equation is shown (not asked); place P01, P12, P23.
3. Connect neighbors, cut again, down to P0123. It is on the curve, and
   P012P123 is tangent there.
4. Pick L's and R's control points in order; see them over the original.
5. Pick L or R (called Q), build its whole triangle (points only placeable
   after their parents; segments drawn automatically), pick QL and QR.
   The canvas zooms in on Q.
6. Stopping rules, presented as **a choice that depends on context**:
   an intro page; an illustration of "flat enough" (one piece, zoomed in,
   with its chord, the distances d1 and d2 from the inner control points,
   a tolerance band, and the shaded convex hull; buttons walk the tree of
   pieces); then try fixed depth / flat enough / short enough; then
   questions on the convex hull property and on choosing for a context.
7. Step through the recursion's calls (flatness tolerance 4 world units:
   10 segments, 19 calls). Students predict the first 3 line segments by
   clicking.
8. Put the shuffled pseudocode of `drawBezier` in order (a Parsons
   problem, with guiding questions). The final page shows the reference.

## Files
- `index.html`: the side panel (stage buttons, progress, step, triangle)
  and the canvas. All CSS is here.
- `stages.js`: all content: the fixed curve, and the `STEPS` array (text,
  questions, answers, hints). Its header documents every step type.
- `index.js`: the engine, in 9 sections (canvas and fitting, state, Bézier
  math, subdivision and trace, drawing helpers, `draw()`, step rendering
  and checking, canvas input, side panel and `goToStep`).

## Rules for this tool
- Content changes go in `stages.js`; keep `index.js` free of activity text
  (except short feedback messages tied to engine behavior).
- Use geometric terms: "midpoint", never "averaging".
- Everyone gets the same fixed curve (`CONTROL_POINTS`), so hints and the
  equal-length question can rely on its shape. If it changes, recheck the
  lengths, the trace size, and the label offsets (`LABEL_OFFSETS`).
- No scores and **no typed answers** (the instructor's choice): every step
  is reading, clicking, or choosing, and is checked automatically. Misses
  on the first try go on a review list, saved under `REVIEW_KEY`
  (`bezierSubdivisionReview`).
- Coordinates: world units (640 × 400 box, y down), scaled to fit.
  Stage 6's rules measure in screen pixels; stage 7's trace uses world
  units so it is the same on every screen.
- The stage buttons jump to any stage with earlier work filled in
  (`goToStep`), for demonstrating. Students can use them to skip ahead.

## Open issues
- Not yet tried by a person in a browser (only scripted runs), including
  clicking points by hand and dragging in stage 1.
