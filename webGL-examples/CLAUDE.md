# Claude instructions: WebGL examples

Teaching examples for a university computer graphics course. Each example
lives in its own folder under `examples/`, with its own `CLAUDE.md` (rules
and current state for that example) and `NOTES.md` (its development
history). Some examples have a self-check quiz in a `quiz-selfcheck/`
folder.

## Working rules
- Always ask before creating, editing, or deleting files. Propose first,
  then wait for approval.
- When building or editing a quiz, read `notes/quizzes.md` first.
- Don't fix problems in an example unless asked. Mention them instead.

## Project layout
- `README.md`: overview for people, and how to open each example
- `notes/quizzes.md`: how to build and maintain a self-check quiz (applies to all quizzes)
- `notes/NOTES.md`: project-level history, decisions, and deferred ideas.
  Add a dated entry after any change that affects the whole project.
- `examples/<name>/`: one folder per example
  - `CLAUDE.md`: rules, structure, and open issues for that example
  - `NOTES.md`: what was done in past sessions, and why

## WebGL version
- **Target: WebGL 2** (`canvas.getContext('webgl2')`, GLSL ES 3.00 shaders
  with `#version 300 es`).
- The three current examples (cube-grid, camera-move,
  cube-color-alternatives) are still **WebGL 1** (`getContext('webgl')`,
  `attribute`/`varying`, `gl_FragColor`). Porting them is planned as a
  separate task. Their quizzes and exploration notes quote the code, so
  they must be updated with the port.

## Style for all examples
- Plain WebGL. No libraries (no glMatrix, no three.js), no build step, no
  ES modules, no web server needed. Students open the `.html` file by
  double-clicking it.
- Matrix math is written by hand in each example, in column-major order.
- Each example is a single program a student can read top to bottom, in
  numbered sections (get the context, shaders, geometry and buffers, scene,
  matrix helpers, draw/animate).
- Shaders stay **inline**, as JavaScript template strings in the example's
  `.js` file. Don't move them into separate files: loading a `.glsl` file
  needs `fetch()`, which browsers block on `file://`. Mark every shader
  string with both GLSL markers, so students get GLSL syntax highlighting
  in either VS Code or a JetBrains IDE:
  ```js
  // language=GLSL
  const vertexShaderSource = /* glsl */ `
  ```
  Section 1's header comment says what the markers are for. In WebGL 2,
  `#version 300 es` must be the first line of the source, so it goes right
  after the backtick: ``/* glsl */ `#version 300 es``. See
  `notes/NOTES.md` (2026-10-16, "shader syntax highlighting").
- Comment heavily: a header comment per section explaining what and why,
  plus line-by-line comments. The audience is students new to WebGL.
- Wording: plain and direct. Use "scale", not "stretch"; "returns", not
  "hands back". Use the standard technical term once the course has taught
  it (column-major, interpolated, clip space, depth testing).

## Terminology
Use these terms in code comments, notes, and quizzes:
- **Interpolate**, never "blend", for what the rasterizer does to varyings.
  In WebGL, "blending" is the separate `gl.BLEND` stage that mixes a
  fragment with the framebuffer.
- **Fragment**, not "pixel", for what the rasterizer produces and the
  fragment shader works on: a candidate pixel, one triangle's contribution
  to one pixel. "Pixel" is still right for canvas pixels, the depth buffer,
  and the final on-screen result.
- **Cube corner** for the 8 positions of a cube; **vertex** for the 3
  vertices of a triangle (and the 36 stored vertices).
- **Rasterizer**, not "the GPU", as the thing that interpolates varyings.
- The vertex shader outputs **clip space**, not "screen" coordinates.
- Uniforms are shared by every vertex *and* every fragment of a draw call.
- **Barycentric coordinates** for the interpolation weights (λ₀, λ₁, λ₂).

## Accuracy: common over-simplifications
Reread comments, notes, and quiz text for statements that are only roughly
true. These came up before and needed fixing:
- The normal is a per-vertex value, not "the direction the face points".
  On a cube each face's vertices are given that face's normal, which is
  why corners are repeated; a smooth mesh would average face normals.
- `mat3(model)` for normals only works when the model has no non-uniform
  scaling or shear along non-axis directions (e.g. axis-aligned normals
  with axis-aligned scaling, or pure rotation). In general you need the
  inverse transpose.
- The dot product equals the cosine only for unit vectors.
- `STATIC_DRAW` is a hint, not a rule.
- The viewport maps NDC, not clip space.
- `clientWidth` is in CSS pixels; high-DPI screens also need
  `window.devicePixelRatio` to be fully sharp.
- The field of view in `perspective` is vertical.

Where a simplification is right *for this program* but not in general, say
both briefly ("This works here because…; in general…").

## Testing
- Syntax check: `node --check file.js`.
- Claude in Chrome **cannot open `file://` URLs**. To check pages in the
  browser, serve the folder temporarily
  (`python3 -m http.server 8765 --bind 127.0.0.1`), open the page, check
  the console for errors, then stop the server.
- Automated mouse drags often don't fire browser drag events. Test
  drag-and-drop with click alternatives or synthetic events, and ask the
  instructor to try a real drag by hand.
