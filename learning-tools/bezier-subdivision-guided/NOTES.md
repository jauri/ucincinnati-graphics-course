# Cutting a Bézier curve in two: notes

## 2026-10-23: first version
- Designed with the instructor as a guided, discover-it-yourself activity
  for recursive subdivision, separate from the Bézier playground.
- Instructor's requirements:
  - Students choose t themselves and must know it does not have to be ½;
    they explain why ½ is a good choice.
  - Ask whether t = ½ cuts the curve into equal lengths, with an
    illustration.
  - Stage 2 only asks that the cut is a midpoint, and for the midpoint
    equation.
  - Stopping rules are presented as a choice that depends on the context.
  - Always use geometric terms ("midpoint", not "averaging").
- Choices the instructor agreed to: a fixed curve for everyone; quiz-style
  self-check for written answers (no scores, review list); content in
  `stages.js` and engine in `index.js`; stage buttons for jumping.
- Built in two steps (stages 1–4, then 5–8). Changes found while testing:
  the canvas zooms in on Q in stage 5 (its points were 20–30 px apart);
  the panel widens in stage 8 so the pseudocode lines fit.
- Tested with scripted runs in Chrome through all 38 steps (37 after removing the "why ½" question), including
  wrong answers; no console errors.

## Ideas for later
- Let students choose their own curve.
- Show the flatness measure (perpendiculars from the inner control points
  to the chord) for one piece in stage 6.
- A version for quadratic curves, or for general t.

## 2026-10-23: removed the "Why t = ½?" question
- At the instructor's request, removed the stage 1 free-text question
  asking why ½ is a good choice, and the "Next, explain why" sentence in
  the choose-t feedback. Students still choose t themselves and are told
  other values work.

## 2026-10-23: no typed answers
- At the instructor's request, removed every free-typed answer:
  - Stage 2: the midpoint equation is now shown on an info page.
  - Stage 6: "When should we stop?" is now an intro page (stopping is a
    choice that depends on context), with no question.
  - Stage 8: removed writing the pseudocode and the self-check; the
    Parsons problem keeps the guiding questions, and the final page shows
    the reference pseudocode.
- Removed the engine's `freetext` and `selfcheck` step types and their CSS.

## 2026-10-23: stage 6 reworked
- Removed the three stage 6 questions (convex hull, zoomable text, fixed
  number of levels), at the instructor's request.
- Added an illustration of the chord-based "flat enough" test (new step
  type `flatness`): one piece zoomed in, its chord, perpendicular
  distances d1 and d2 (green if within the tolerance, red if not), the
  tolerance band, the shaded convex hull, and a verdict. Buttons move to
  the piece's L or R half or back up; a slider sets the tolerance (world
  units, starting at 4, as in the stage 7 trace).
- Then restored the three stage 6 questions: removing them was an
  accidental click. The flatness illustration stays.
