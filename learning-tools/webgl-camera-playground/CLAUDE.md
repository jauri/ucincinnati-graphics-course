# Tool: WebGL camera playground (webgl-camera-playground)

Students set a camera's eye, target, up vector, and lens with sliders and
see three things change together: the camera seen from outside (world
view), what the camera sees (camera view), and the lines of WebGL code
that set up the camera. History is in `NOTES.md`. A guided activity
(`webgl-camera-guided`) is planned to follow.

**Main teaching point: `lookAt(eye, target, up)` builds the camera's own
three axes, and the view matrix uses them to move the whole world so the
eye is at the origin, looking down −z.** Also: only the direction from
eye to target matters, not the distance; the up vector does not have to
be perpendicular to the view direction, but it must not be parallel to
it; the projection matrix is the lens (vertical field of view, aspect
ratio, near and far planes), and together they shape the view frustum.

**Status: built 2026-10-28; checked in headless Chrome, not yet tried by a person.**

## Terminology (for all student-facing text: labels, notes, comments)
Correct and simple. Use one term per idea, the one the course uses:
- **eye** (the camera's position), **target** (the point it looks at),
  **up vector**. In prose, "camera position" may explain "eye" once.
- **view direction**: from the eye toward the target. The camera looks
  down its own **−z axis**, so its **z axis** points from the target
  toward the eye (backward). Say this plainly; it is the usual confusion.
- **camera axes** x (right), y (up), z (backward): three perpendicular
  unit vectors in world coordinates. Not "basis" in student text (it may
  appear once in a code comment).
- **view matrix** (world space → camera space) and **projection matrix**
  (camera space → clip space). Not "camera matrix", which is ambiguous.
  The view matrix is the **inverse** of the camera's placement.
- **world space**, **camera space**, **clip space**: as in
  `camera-move`. Not "eye space" or "view space" (same thing, new name).
- **field of view**: always say **vertical** where its meaning matters.
  **aspect ratio** = width / height. **near plane**, **far plane**;
  objects outside them are **clipped**.
- **view frustum** (a pyramid with its tip cut off); "frustum" alone
  after that.
- **roll**: turning the camera about its view direction.
- **unit vector**, **normalize**, **cross product**, **perpendicular**,
  **parallel**: never "flatten", "squash", "line up with".
- Same rules as `../../webGL-examples/CLAUDE.md` (terminology and the
  accuracy list), e.g. the field of view is vertical; the viewport maps
  NDC, not clip space.

## Layout (`index.html`)
- **Side panel**: preset menu (with a one-line note for the current
  preset), slider groups, and an "explanation" box that turns red with a
  plain message when the camera can't be built.
- **Main area**: world view and camera view side by side (stacked on
  narrow screens), and the **code panel** below them, with the
  **definition panel** beside it when open.
- Each slider shows its value. Sliders only; no typed numbers.

## Controls
| Group | Sliders | Range | Step |
|---|---|---|---|
| eye | x, y, z | −15 … 15 | 0.1 |
| target | x, y, z | −10 … 10 | 0.1 |
| up vector | x, y, z | −1 … 1 | 0.05 |
| lens | field of view (vertical, degrees) | 10 … 120 | 1 |
| lens | near | 0.1 … 10 | 0.1 |
| lens | far | 1 … 60 | 0.5 |
| lens | aspect ratio | menu: "match the canvas", 1.0, 2.0 | — |

- The up vector is **not** normalized by the sliders: students see that
  `lookAt` doesn't need a unit up vector.
- The aspect menu lets students see the stretching caused by a wrong
  aspect ratio. "match the canvas" uses the camera view's real
  width / height.
- **World view controls**: angle (default 40°), height (8) and distance
  (18) of the world view's viewpoint, which orbits the fixed point
  `WORLD_VIEW_TARGET` = (3, 1.5, 0), between the scene and the camera's
  start. These never change the camera; the panel says so.

## Presets
Each sets every slider; the note says what to look for.
1. **Start** (as in `camera-move` at time 0): eye (9, 4, 0), target
   (0, 0.5, 0), up (0, 1, 0), field of view 45°, near 0.5, far 15.
   Note: up is not perpendicular to the view direction here (the camera
   looks slightly down), and that's fine.
2. **Target farther along the same line**: target moved past the center
   on the eye→target line. Same image: only the direction matters.
3. **Rolled camera**: up (0, 1, 0.5). Only the `up` line in the code
   changes.
4. **Up vector tilted forward**: up (-0.6, 0.6, 0), which is a
   positive multiple of (0, 1, 0) plus a multiple of the view direction
   (and not a unit vector). Same image as Start: the cross product
   ignores the part of up along the view direction.
5. **Looking straight down (broken)**: eye (0, 12, 0), target (0, 0, 0),
   up (0, 1, 0). Up is parallel to the view direction, so
   cross(up, z) = (0, 0, 0) and can't be normalized. Explained in words.
6. **Looking straight down (fixed)**: same, with up (0, 0, −1).
7. **Wide-angle lens**: field of view 100°.
8. **Zoomed-in lens**: field of view 20°.
9. **Near plane cuts the tower**: near 9.6 (the tower spans about
   9.2 to 10.1 in front of the eye).
10. **Far plane cuts the scene**: far 10.5. The teal box is clipped
    completely, the yellow box partly, and the back of the floor.

## The two views (real WebGL 2)
- **Scene**: the `camera-move` scene (floor, a tall tower in the center,
  three smaller boxes), same unit cube, per-face shade instead of
  lighting.
- **Colors**: the camera axes use the usual x = red, y = green,
  z = blue. The scene objects use other colors (tower orange; boxes
  purple, teal, yellow) so no box is mistaken for an axis.
- **Camera view**: `projection * view * model * position`, with the
  matrices from the sliders.
- **World view** draws, from its own orbiting viewpoint:
  - the scene;
  - small gray **world axes** at the origin, labeled X, Y, Z;
  - the **camera**: a small box at the eye, turned to match its axes;
  - the **camera axes** as red / green / blue arrows from the eye;
  - a dotted line from eye to target, labeled "view direction (−z)", and
    a dot at the target;
  - the **up vector** as a thin arrow from the eye (its real direction
    and length, so students see it differs from the camera's y axis);
  - the **view frustum** as a wireframe from the near plane to the far
    plane, using the same field of view, aspect ratio, near and far.
- Labels (eye, target, x, y, z, up) are drawn on a 2D canvas over the
  world view, at the projected positions.
- When the camera can't be built (up parallel to the view direction, a
  zero up vector, eye = target, or near ≥ far), the camera view shows the
  reason in words, and the world view shows only the eye, target, and up
  arrow.

## The code panel
Generated from the same state object the renderer uses, so the code and
the pictures always agree. Read-only. The code uses the names in
`camera-move/index.js` (`lookAt`, `perspective`, `viewMatrix`,
`projectionMatrix`) so students recognize it.

**Basic panel (always shown):**
```js
// 1. Where the camera is and how it's aimed
const eye    = [ 9.00, 4.00, 0.00 ];
const target = [ 0.00, 0.50, 0.00 ];
const up     = [ 0.00, 1.00, 0.00 ];
const viewMatrix = lookAt(eye, target, up);

// 2. The lens
const fieldOfView = 45 * Math.PI / 180;            // vertical
const aspect      = canvas.width / canvas.height;  // = 1.33
const near = 0.5;
const far  = 15.0;
const projectionMatrix = perspective(fieldOfView, aspect, near, far);

// 3. Send both matrices to the vertex shader
gl.uniformMatrix4fv(viewLocation,       false, viewMatrix);
gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
```
- A fixed aspect choice shows as `const aspect = 1.0;` with a comment
  `// the canvas is 1.33 → the image is stretched`.
- **Changed numbers light up** for about half a second.
- **Linked highlighting**: hovering or dragging a slider highlights its
  code line and the matching thing in the world view (eye dot, target
  dot, up arrow, frustum); hovering a code line highlights its sliders
  and the same world-view object.
- When the camera can't be built, the `lookAt` line is marked red with a
  short comment, e.g. `// up is parallel to the view direction`.
- A line under the panel always shows **the target in camera space**,
  e.g. `(0.00, 0.00, -9.66)`: it's always on the −z axis, at minus the
  eye-to-target distance.

**Definition panel (on demand, beside the code):**
The function names `lookAt`, `perspective` and both `uniformMatrix4fv`
are links (dotted underline). Clicking one opens a panel beside the
code; clicking it again or ✕ closes it. One panel at a time. When there
isn't room (main area narrower than about 1150 px) the panel wraps below
the code as its own framed card. Why not inline under the call (the
first version): the indented lines looked like code from the program
that had been hidden.
1. **`lookAt`**: heading "Definition of `lookAt`", a note that it is a
   helper in the program's matrix helpers (Step 6 of camera-move) that
   the line on the left calls. The whole function word for word as in
   camera-move (its 3-line comment rewrapped to shorter lines, same
   words). Live values in a separate **values column** as chips (not
   code): zAxis, xAxis, yAxis in their axis colors, and each returned
   column with its numbers colored by row (x red, y green, z blue).
   Failures: the failing line is red with a red chip ("cross(up, zAxis)
   = [ 0, 0, 0 ]: can't normalize"); later lines show "not computed".
   No chips for eye / target / up (they're in the code on the left).
2. **`perspective`**: the whole function word for word; chips for
   fieldOfView (radians), f, rangeInv, and each returned column. A
   prose note: the field of view is vertical; y is scaled by f, x by
   f / aspect.
3. **`uniformMatrix4fv`** (view or projection): a WebGL function, so no
   definition. Heading "What `gl.uniformMatrix4fv` sends: viewMatrix",
   the 16 floats column by column, then the same numbers as a matrix
   table with prose row notes ("row 1: xAxis, then −dot(xAxis, eye)").
- Hovering a row in the panel highlights like the code lines do.

The derivation of the view matrix (inverse of the camera's placement,
Rᵀ · T⁻¹) belongs to the guided activity, not to this panel.

## Files
- `index.html`: layout, controls, all CSS (light and dark).
- `index.js`, in numbered sections:
  1. Presets and slider ranges.
  2. The program state.
  3. Vector and matrix math by hand: `subtract`, `dot`, `cross`,
     `normalize`, `lookAt` (same as `camera-move`, plus checks for the
     cases where it can't be built), `perspective`, `multiply`, and the
     camera's placement matrix (to draw the camera and frustum in the
     world view).
  4. WebGL 2 setup: shaders (with both GLSL markers), cube geometry,
     line geometry.
  5. Drawing the camera view.
  6. Drawing the world view: scene, camera, axes, up arrow, frustum,
     labels.
  7. The code panel and the definition panel: text from the state,
     the function definitions with their values column, the
     uniformMatrix4fv view, change highlighting.
  8. Controls, linked highlighting, and `update()`.

## Style
Follow `../CLAUDE.md`: plain JavaScript, no libraries or build step,
works from `file://`, matrix math by hand in column-major order,
numbered sections, heavy comments, high-DPI canvases. WebGL 2 with
GLSL ES 3.00, as in `../../webGL-examples/CLAUDE.md`. Two canvases each
get their own WebGL 2 context and their own copy of the buffers (a
comment explains why: a WebGL buffer belongs to one context).

## Implementation notes
- Lines, arrows, dots and labels in the world view are drawn on the 2D
  overlay, projected with the world view's matrices; segments are cut at
  z = -0.1 in its camera space so points behind it never project.
- `checkCamera` repeats lookAt's steps with checks (eye = target, zero
  up, up parallel) because `lookAt` is kept identical to camera-move.
- Highlight names (`data-link`): eye, target, up, view, fov, aspect,
  near, far, proj. `ARGUMENTS_OF` maps view / proj to their sliders.
- The code and definition panels are rebuilt as HTML on every update;
  numbers are keyed (`num`) so only the ones whose text changed get the
  `changed` flash. `state.detail` names the open panel.
- The definitions are text in section 7, copied from camera-move's
  `lookAt` and `perspective`. If those change, update them by hand.

## Testing
- Claude in Chrome was not connected, so checks used headless Chrome
  (`--use-angle=swiftshader`) on a test page in the session scratchpad
  that loads the tool in an iframe, sets presets, opens a definition
  panel, hovers lines and moves a slider, and reports errors.
- Checked: no errors in all 10 presets; check-box messages; the broken
  top-down camera; numbers against hand calculation (Start: z ≈ (0.93,
  0.36, 0), x = (0, 0, -1), y ≈ (-0.36, 0.93, 0), last column (0, -0.47,
  -9.84)); wrong aspect stretches; linked highlighting; only changed
  numbers flash.

## Open issues
- Not tried by a person yet: real slider dragging and hovering, dark
  mode, phone-width screens.
- The camera's body in the world view is small at the default distance.
