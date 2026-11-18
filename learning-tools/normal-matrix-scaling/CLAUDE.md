# Tool: Normals under non-uniform scaling (normal-matrix-scaling)

An illustration (sliders, no questions) of why vertex normals need their
own matrix. Two spheres side by side, scaled by the same `scale(sx, sy,
sz)`: the left one transforms its normals with the model matrix, the
right one with the normal matrix `(M⁻¹)ᵀ`. Normals are drawn as line
segments. Below the views is the code for both; beside them, a stepped
explanation that derives the normal matrix. History is in `NOTES.md`.

**Main teaching point: a normal must stay perpendicular to the surface.
Tangents move with the surface (`t' = M t`), but normals don't: with
non-uniform scaling, `M n` is no longer perpendicular. The matrix that
keeps it perpendicular is the normal matrix, `(M⁻¹)ᵀ`, made from the
upper-left 3 × 3 of the model matrix.** Also: with uniform scaling `M n`
has the right direction (only its length is wrong, and normalizing fixes
it); for a rotation `(R⁻¹)ᵀ = R`; translation is dropped because normals
are directions; normals must be normalized again after transforming and
after interpolation.

**Status: built 2026-11-18; checked in headless Chrome, not yet tried by a person.**

## Decisions made while building
- Normal lines, the sample arrows and their labels are drawn on a 2D
  canvas over each WebGL canvas (WebGL lines are 1 px wide), so they can
  be thick. That canvas has no depth test: normals whose true normal
  points away from the eye are hidden (exact for a convex shape). The
  sample vertex is faded instead of hidden when it is on the far side.
- The overlay computes the drawn normals with `leftNormal` /
  `rightNormal` (section 6), JS copies of the ◀ shader lines.
- Readout wording: "worst normal: 27.3° from the true normal" (clearer
  than "off perpendicular"). The worst value is over all normals, seen or
  not.
- The sample arrows have a white outline so they stand out.
- The differing lines are marked with a `// ◀` comment in the source;
  the code panel highlights lines that contain ◀.
- `drawSphere` (the light uniforms and draw call) is shown with the
  fragment shader under "Both views".
- "Try it" buttons are on steps 1–3, 5 and 6.
- Camera: distance 8, vertical field of view 45°. At scale 1 the sphere
  is about a third of the view's height.

## Terminology (all student-facing text: labels, steps, comments)
- **normal** (or **vertex normal**): a unit vector perpendicular to the
  surface at a vertex. **tangent**: a direction along the surface at
  that point. Say "perpendicular", not "sticking straight out".
- **model matrix** `M`; **normal matrix** `(M⁻¹)ᵀ`, read "the inverse
  transpose of M". Write it `(M⁻¹)ᵀ` in prose and
  `transpose(inverse(M3))` in code. Not "inverse matrix" alone: the
  transpose is part of it.
- **uniform scaling** (same factor on every axis) and **non-uniform
  scaling**. Not "even/uneven" in student text.
- **upper-left 3 × 3** of the model matrix (written `mat3(M)` in GLSL).
- **dot product**, **transpose**, **inverse**, **identity matrix**,
  **normalize**, **unit vector**. Not "flip", "undo" or "squash" for
  matrix operations.
- **ellipsoid**: what the scaled sphere becomes. Use it once the
  sphere is scaled.
- **world space**: lighting is done here (see Shading). Camera space is
  mentioned only in step 7.
- Same rules as `../../webGL-examples/CLAUDE.md` (terminology and the
  accuracy list).

## Layout (`index.html`)
```
┌──────────┬──────────┬─────────────┐
│  left    │  right   │ Step 3 of 7 │
│  sphere  │  sphere  │ …           │
│          │          │             │
├──────────┴──────────┤ [Back][Next]│
│ code panel          │             │
└─────────────────────┴─────────────┘
```
- **Side panel (left of the views or above on narrow screens)**: preset
  menu with a one-line note, the sliders, toggles.
- **Views**: left and right sphere side by side (stacked on narrow
  screens). Titles:
  - left: "Normals × model matrix" with `n' = mat3(M) · n`
  - right: "Normals × normal matrix" with `n' = (M⁻¹)ᵀ · n`
- **Steps panel**: to the right of the views, one step at a time, with
  Back / Next and "Step k of 7". The views stay visible while reading.
  On narrow screens it goes below the views.
- **Code panel**: below the views.

## Controls (sliders only; each shows its value)
| Control | Range | Step | Start |
|---|---|---|---|
| scale x, y, z | 0.25 … 3 | 0.05 | 1 |
| view angle (orbit about the y axis, degrees) | −180 … 180 | 1 | 30 |
| view height (degrees above the xz plane) | −60 … 60 | 1 | 20 |
| show normals | checkbox | — | on |
| shading | checkbox | — | on |

- **One shared set** of scale sliders drives both spheres, so the only
  difference between the views is how the normals are transformed.
- The view sliders move one shared camera for both views; they never
  change the model matrix. The panel says so.

## Presets
Each sets the three scale sliders; the note says what to look for.
1. **Sphere** (1, 1, 1): both views agree; every normal is green.
2. **Uniform × 2** (2, 2, 2): still agree. `M n` is twice as long, but
   points the right way, and normalizing fixes the length.
3. **Stretch x** (3, 1, 1): left normals lean toward the x axis; the
   surface leans away from it. Worst near 45° between x and the others.
4. **Squash y** (1, 0.3, 1): a flat disc. Largest error; left lighting
   is clearly wrong on the rim.
5. **Mixed** (2, 0.5, 1).

## The two views (real WebGL 2)
- **Model**: a UV sphere of radius 1, 16 segments around × 12 from pole
  to pole, with positions and normals (for a unit sphere, normal =
  position). Model matrix `M = scale(sx, sy, sz)` only.
- **Normals as line segments**: one per unique vertex (the poles once
  each), from the transformed vertex along the transformed normal,
  **normalized** and drawn at a fixed length (about 0.25), so students
  compare only directions. The left view uses `mat3(M) · n`, the right
  `(M⁻¹)ᵀ · n`, with the same functions shown in the code panel.
- **Error coloring**: each normal segment is colored by its angle from
  the true surface normal of the ellipsoid at that point. The true
  normal is computed separately, from the ellipsoid's equation
  (`(x/sx², y/sy², z/sz²)` at the scaled point), so the check doesn't
  just compare the right view with itself.
  - 0° green, rising through yellow to red at 30° or more. Lightness and
    line width change too (thicker and darker when wrong), so the scale
    doesn't depend on hue alone.
  - A small legend under the views.
  - A readout under each view: "worst normal: 27.3° from the true
    normal" (the right view always reads 0.0°, up to rounding).
- **Shading** (toggle): the same directional light in world space for
  both views, diffuse plus a small ambient term, using each view's own
  normal transform in the vertex shader and normalizing again in the
  fragment shader. Light from upper front left, fixed. When off, the
  sphere is flat gray so the normal lines stand out.
- **Sample vertex**: one vertex, at latitude 45°, longitude 45°
  (unit normal (0.5, 0.707, 0.5)), marked with a dot in both views. At
  it, both views draw its normal and one tangent arrow (the direction
  along the meridian, toward the north pole: unit tangent
  (−0.5, 0.707, −0.5)), transformed by `M` in both views. Different
  colors from the error scale (e.g. the tangent in blue).
- Both views use the same camera: perspective, looking at the origin
  from the view angle / height sliders, at a distance that fits a sphere
  scaled to 3.

## The code panel
- Side by side: the left and right **vertex shaders**, then the JS that
  sets their uniforms for one frame. The lines that differ are
  highlighted:
  - shader: `v_normal = mat3(u_model) * a_normal;` vs
    `v_normal = u_normalMatrix * a_normal;`
  - JS: the right side computes
    `normalMatrix = transpose3(inverse3(upperLeft3(modelMatrix)))` and
    sends it with `gl.uniformMatrix3fv`.
- The fragment shader (shared) is shown once, below, with its
  `normalize(v_normal)` line commented.
- **The code on screen is the code that runs**: the shader sources are
  the strings compiled, and the JS functions are shown with
  `fn.toString()` (as in `triangle-drawing-modes`). Keep those functions
  readable as student code: they are the lesson.
- No live matrix display (instructor's choice); the steps show the
  matrices symbolically.

## The steps panel (7 steps)
Steps never change the sliders by themselves. Some have a **Try it**
button that applies a preset. Each step is short: a heading, two to
four sentences or a few equation lines, and what to look at in the views.

1. **What a normal is.** A normal is perpendicular to every tangent at
   its point: `n · t = 0`. Look at the sample vertex in the Sphere
   preset: the normal and tangent meet at a right angle.
2. **Tangents move with the surface.** A tangent is a direction along
   the surface, so when the surface is transformed it becomes
   `t' = M t` (the upper-left 3 × 3; directions ignore translation).
   Try it: Stretch x. The tangent arrow tilts with the surface in both
   views.
3. **Try `n' = M n`.** Live: the **cosine of the angle between n' and
   t'** at the sample vertex (both normalized), for the left view, e.g.
   "n'·t' = −0.67 (angle 131.8°; perpendicular is 0, 90°)". It is 0 for
   uniform scaling, not 0 otherwise. Geometric reason: stretching along
   x tilts the surface toward the x axis, and `M n` tilts toward the
   x axis too, but a normal must tilt away from it. The right view's
   value is shown next to it and stays 0.
4. **Find the matrix that keeps them perpendicular.** Revealed one line
   at a time with Next, each with a one-sentence reason:
   - `n · t = nᵀ t = 0` (write the dot product as a matrix product)
   - `nᵀ t = nᵀ (M⁻¹ M) t` (`M⁻¹ M` is the identity matrix)
   - `= (nᵀ M⁻¹)(M t)` (group differently)
   - `= ((M⁻¹)ᵀ n)ᵀ (M t)` (transpose rule: `(AB)ᵀ = Bᵀ Aᵀ`, so
     `nᵀ M⁻¹ = ((M⁻¹)ᵀ n)ᵀ`)
   - `= n'ᵀ t'` with `n' = (M⁻¹)ᵀ n` and `t' = M t`. It equals
     `n · t = 0`, so `n'` is perpendicular to every transformed tangent.
5. **What it is for scaling.** `M = diag(sx, sy, sz)`, so
   `M⁻¹ = diag(1/sx, 1/sy, 1/sz)`, and a diagonal matrix is its own
   transpose: `(M⁻¹)ᵀ = diag(1/sx, 1/sy, 1/sz)`. The normal is scaled
   by the reciprocal: it shrinks along the stretched axis, the opposite
   of the surface. Try it: Squash y.
6. **Special cases.**
   - Uniform scaling `s I`: `(M⁻¹)ᵀ = (1/s) I`, same direction as
     `M n`; normalizing fixes the length. Try it: Uniform × 2.
   - Rotation `R`: `R⁻¹ = Rᵀ`, so `(R⁻¹)ᵀ = R`. The model matrix
     already works.
   - Translation: dropped by using the upper-left 3 × 3, because normals
     are directions, not points.
7. **In practice.**
   - Compute the normal matrix once per frame (or per object) in JS and
     send it as a `mat3` uniform; don't invert in the shader per vertex.
   - Normalize after transforming, and again in the fragment shader,
     because interpolating unit vectors gives shorter vectors.
   - If lighting is done in camera space, use the normal matrix of the
     model-view matrix, `(mat3(V M))⁻¹ᵀ`. This tool lights in world
     space, so it uses `M` alone.

## Files
- `index.html`: layout, controls, steps panel markup, all CSS.
- `index.js`, in numbered sections a student can read top to bottom:
  1. Presets and slider ranges.
  2. Matrix helpers (4 × 4 and 3 × 3: scale, perspective, lookAt,
     upperLeft3, inverse3, transpose3, multiply).
  3. The sphere (positions, normals, indices; unique vertices for the
     normal lines).
  4. The shaders (the strings shown in the code panel).
  5. Setting up and drawing each view (the functions shown in the code
     panel).
  6. Normal lines, true ellipsoid normals, error coloring, sample vertex
     and tangent.
  7. The code panel.
  8. The steps panel.
  9. The page (sliders, presets, toggles, resize).
- Link from the repo's root `index.html` and a row in
  `../README.md`.

## Testing
- `node --check index.js`.
- Serve the folder (`python3 -m http.server 8765 --bind 127.0.0.1`),
  open in Chrome, check the console, then stop the server.
- Check: no WebGL errors; right view's worst error is 0.0° for every
  preset; left view's is 0.0° for Sphere and Uniform × 2 and large for
  the others; the sample-vertex cosine in step 3 matches a hand
  calculation (Stretch x: −0.667); layout at wide and phone widths.
- Ask the instructor to try the sliders by hand.
- Done 2026-11-18 (headless Chrome, `--use-angle=swiftshader
  --enable-unsafe-swiftshader`, with a probe page in the scratchpad
  calling `applyPreset`): no WebGL errors; worst left / right error:
  Sphere 0.0 / 0.0, Uniform × 2 0.0 / 0.0, Stretch x 53.1 / 0.0,
  Squash y 56.6 / 0.0, Mixed 61.9 / 0.0; sample cosine left −0.6667 for
  Stretch x; screenshots at 1500 px and 500 px wide, step 3 and step 4
  (all 5 lines) checked.

## Open issues
- Not tried by a person yet: slider feel, Back / Next through step 4.
- At Squash y the disc is small in the view; the sample arrows are long
  compared with it.
- No dark mode (as in the other tools).
