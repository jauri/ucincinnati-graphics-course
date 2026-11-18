# Normals under non-uniform scaling: notes

## 2026-11-18: spec
- The instructor asked for an activity on non-uniform scaling, its
  effect on vertex normals, and the need for an inverse transform: two
  spheres side by side with their vertex normals drawn, scalable in x,
  y and z with sliders, so students see what happens to the normals
  when the scaling isn't uniform. Then the code for both and a
  step-by-step explanation of computing the normal matrix. No questions
  to test knowledge: illustration and explanation only.
- Instructor's choices:
  - One shared set of scale sliders for both spheres (only the normal
    transform differs).
  - Steps one at a time with Back / Next, in a panel beside the views
    so the views stay visible.
  - Extras: error coloring (with a "worst normal" readout) and shading.
    Not wanted: a 2D cross-section inset, a live matrix display.
  - Name `normal-matrix-scaling`.
- Proposed by Claude and approved with the spec:
  - Without the inset, the sample vertex and its tangent arrow are
    drawn in both 3D views, and step 3 shows one live number (the
    cosine of the angle between n' and t').
  - The error is measured against the ellipsoid's true normal, computed
    from its equation, not against the right view.
  - Code panel uses `fn.toString()` and the compiled shader strings, so
    the code on screen is the code that runs.

## 2026-11-18: first version built
- Built `index.html` and `index.js` to the spec; linked from the root
  `index.html` and `learning-tools/README.md`.
- Choices made while building (recorded in `CLAUDE.md`, "Decisions made
  while building"): 2D overlay for the normal lines with far-side
  normals hidden; readout says "from the true normal"; white outline on
  the sample arrows (the left n′ arrow was lost among the red normals).
- Checked in headless Chrome only; numbers match the hand calculation.

## Ideas for later
- Add a rotation slider to show that rotation needs no special matrix.
- Specular highlights, which make wrong normals even easier to see.
- A non-sphere model (a cube with rounded edges, a torus).
- Lighting in camera space, with the normal matrix of the model-view
  matrix.
