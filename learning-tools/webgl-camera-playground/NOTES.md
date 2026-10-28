# WebGL camera playground: notes

## 2026-10-28: planning
- Planned with the instructor as the first of two tools on `lookAt` and
  the camera's properties (a guided activity comes next), following the
  buffers work: playground first, then guided.
- Instructor's choices:
  - Scope: `lookAt` and the lens (field of view, aspect ratio, near,
    far). Orthographic projection is not included.
  - Controls: sliders plus presets (no dragging in 3D).
  - Math depth: the full derivation of the view matrix, in the guided
    activity.
  - A **code panel** showing the camera setup code, whose numbers change
    with the sliders. The basic code is shown by default; deeper layers
    (inside `lookAt`, inside `perspective`, the 16 floats
    `uniformMatrix4fv` sends) are available on demand.
  - Correct and simple graphics terminology throughout (list in
    `CLAUDE.md`).
- Decisions proposed by Claude in the spec:
  - Two views: the world view (the camera from outside, with its axes,
    up vector, and frustum) and the camera view.
  - The scene is the `camera-move` scene, recolored (tower orange; boxes
    purple, teal, yellow) so red / green / blue mean only x / y / z.
  - Near 0.5 and far 25 by default (not 0.1 and 100 as in `camera-move`)
    so the frustum fits in the world view. Students can still set them.
  - The code panel is generated from the renderer's state, so code and
    pictures always agree; read-only.

## 2026-10-28: first version built
- Built `index.html` and `index.js` (8 sections) to the spec in
  `CLAUDE.md`.
- Changes found while testing:
  - Default far 15 instead of 25: with 25 the frustum filled the world
    view and the camera looked tiny. 15 still contains the whole scene
    (farthest point about 13.6 from the eye).
  - The world view orbits (3, 1.5, 0) instead of the origin, at 40°, so
    the camera isn't pressed against the edge and its x axis isn't
    pointing at the viewer.
  - "Up tilted forward" uses (-0.6, 0.6, 0) (the spec's example was
    outside the up sliders' range).
  - "Far plane cuts the scene" uses 10.5 instead of 11, so the cut in
    the yellow box is visible.
- Claude in Chrome wasn't connected; tested with headless Chrome instead
  (details in `CLAUDE.md`, Testing).
- Linked from the root `index.html` and `learning-tools/README.md`.

## 2026-10-28: definitions in a side panel
- The instructor found the inline "deeper layers" (▸ under a call)
  confusing: the indented lines looked like code from the program that
  had been hidden.
- Options explored: a side panel on demand, a pop-up (peek), an
  always-visible split; and for the values: a values column, hover
  tooltips, or value lines under each line. The instructor chose the
  side panel on demand with a values column.
- Built: function names are links; the panel shows `lookAt` and
  `perspective` as full definitions (word for word from camera-move)
  with value chips beside them, and `uniformMatrix4fv` as "what it
  sends" (it's WebGL's function, so no definition). The ▸ toggles and
  inline layers were removed.
- Fixed while testing: blank lines in the code panel had collapsed; the
  code column now takes only its own width so the values fit; axis chip
  labels shortened to fit at about 1800 px.
- Checked in headless Chrome at 1800 px (beside) and 1300 px (below),
  all presets with a panel open, the broken camera, and the flash.

## Next: the guided activity (webgl-camera-guided), agreed plan
- A separate, self-contained tool in `learning-tools/webgl-camera-guided/`
  with `index.html`, `index.js` (engine), `stages.js`, `CLAUDE.md`,
  `NOTES.md`, like `bezier-subdivision-guided`. No typed answers.
- Stages:
  1. Eye and target: choose the picture the camera sees; only the
     direction matters.
  2. Up vector: roll; up need not be perpendicular to the view
     direction; where it fails (parallel).
  3. Building the camera axes: put the `lookAt` lines in order; click
     each arrow; why z points backward.
  4. Deriving the view matrix: the camera's placement M = T(eye) · R
     (R's columns are the axes) → view = M⁻¹ = R⁻¹ · T⁻¹ → R⁻¹ = Rᵀ for
     perpendicular unit axes → multiply out: rows are the axes, last
     column −dot(axis, eye). Each step a choice or ordering; formulas
     shown. Then trace the target to (0, 0, −d).
  5. The lens: vertical field of view, near, far, aspect ratio; match
     each change to the frustum and the picture.
- Before building: propose files and stage details to the instructor.

## Ideas for later
- Orthographic vs perspective, side by side.
- Dolly vs zoom: moving the eye vs narrowing the field of view.
