# Example: camera orbit (camera-move)

A camera slowly orbits a small, still 3D scene. WebGL 1 for now (see the
root `CLAUDE.md`). History, student experiments, and next steps are in
`NOTES.md`.

**Main teaching point: the scene never moves; only the view matrix
changes.** Also: the full chain of coordinate spaces (object → world →
camera → clip → screen), why the depth test is needed and why both color
and depth buffers are cleared every frame, and the canvas's two sizes (CSS
size vs. drawing-buffer size; the viewport must match the drawing buffer).

## Files
- `index.html`: a full-window `<canvas>` that loads `index.js`.
- `index.js`: all the WebGL code, in 7 steps:
  1. Get a WebGL context.
  2. Shaders. The vertex shader computes `projection * view * model * position`;
     the fragment shader outputs the object's color times the face's shade.
     Comments explain `attribute`, `uniform`, and `varying`. Both shader
     strings carry the GLSL markers (`// language=GLSL`, `/* glsl */`; see
     the root `CLAUDE.md`).
  3. Compile and link, look up variable locations.
  4. Cube geometry: 36 vertices written out and uploaded to GPU buffers.
  5. Scene description: an array of objects with position, scale, color.
  6. Matrix math by hand: `makeModelMatrix` (scale + translate), `lookAt`
     (the view matrix: moving the camera = moving the world the opposite
     way), `perspective` (the lens). Comments explain column-major storage.
  7. Animation loop (`requestAnimationFrame`): camera on a circle,
     `eye = (R·cos θ, height, R·sin θ)` with θ growing with time; `lookAt`
     the center; clear; draw every object.
- `quiz-selfcheck/`: the self-check quiz.

## The scene
- A floor (wide, thin, gray box), a tall red tower in the center, and three
  smaller boxes (blue, green, yellow) around it.
- Every object is the **same unit cube**, uploaded once, drawn with a
  different model matrix and color.
- Each face has a fixed brightness ("shade") instead of real lighting, on
  purpose, to keep the focus on the camera. Lighting with normals is a
  possible follow-up.
- The constants at the top of step 7 (`ORBIT_RADIUS`, `ORBIT_HEIGHT`,
  `ORBIT_SPEED`, `LOOK_AT`) are meant for students to change.

## Quiz
- 14 cards in program order: vertex shader, fragment shader, compiling and
  linking, variable locations, cube vertex data, uploading buffers, the
  scene, vector helpers, model matrix, view matrix (lookAt), perspective,
  depth test and canvas size, moving the camera, drawing one frame. 5
  questions per card.
- Exploration page: 17 sections, 131 line notes.
- `REVIEW_KEY` is `cameraOrbitQuizReview`.
- `cards.js` and `explore-notes.js` are **copies** of `index.js` code. If
  `index.js` changes, update them by hand and rerun the checks in
  `notes/quizzes.md`.

## Open issues
- Shaders header comment: "The GPU blends (interpolates) it" and "every
  pixel a triangle covers" break the terminology rules ("the rasterizer
  interpolates", "fragment").
- Not checked by a person yet: the wording of the quiz questions and
  exploration notes, and drag-and-drop in the matching step (by hand).
