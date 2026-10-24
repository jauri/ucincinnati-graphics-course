# WebGL buffer playground: notes

## 2026-10-24: first version
- Planned with the instructor as the first of two tools on buffer
  indexing and the WebGL buffer calls (a guided activity comes next).
  Build-up: one triangle → second buffer → interleaved → square with
  `drawArrays` → indexed square → the cube examples' layout.
- Decision: hybrid rendering. A JS simulator shows which bytes are read
  (the GPU can't show that); real WebGL 2 draws the result and reports
  errors, so students see WebGL's actual validation rules rather than a
  simulation's guess (e.g. a stride of 9 is refused, not "garbage").
- Decision: WebGL 2, following `webGL-examples/CLAUDE.md` (the course
  target), although the cube examples are still WebGL 1. The buffer
  calls are the same in both.
- Found in testing: Chrome's WebGL 2 refuses draws that read past the end
  of a vertex buffer (`INVALID_OPERATION`); added that to
  `drawProblems` so the error is explained in words.

- Committed and published on GitHub Pages (commit d882735). Not yet
  tried by the instructor by hand.

## Next: the guided activity (webgl-buffers-guided), agreed plan
- A separate, self-contained tool in `learning-tools/webgl-buffers-guided/`
  (own copy of the simulator and WebGL code, not a shared file), with
  `index.html`, `index.js` (engine), `stages.js` (all text, questions,
  answers), `CLAUDE.md`, `NOTES.md`, like `bezier-subdivision-guided`.
- Same hybrid design and WebGL 2. No typed answers: clicks, choices,
  ordering; misses go on a review list.
- A WebGL state panel runs through every stage so each call's effect is
  visible.
- Stages (each adds one or two calls and what they mean):
  1. Triangle, positions only: `createBuffer`, `bindBuffer(ARRAY_BUFFER)`,
     `bufferData`, `getAttribLocation`, `enableVertexAttribArray`,
     `vertexAttribPointer(size 2, stride 0, offset 0)`,
     `drawArrays(TRIANGLES, 0, 3)`.
  2. Colors in a second buffer: `vertexAttribPointer` uses whichever
     buffer is bound at that moment.
  3. Interleaved: stride and offset in bytes; float vs byte addresses.
  4. Square with `drawArrays`: 6 vertices, 2 duplicates.
  5. Indexed square: `ELEMENT_ARRAY_BUFFER`, `Uint16Array`,
     `drawElements(TRIANGLES, 6, UNSIGNED_SHORT, 0)`; chain
     index → vertex → byte address → values.
  6. Back to the cube: why it uses 36 vertices (a corner's normal and
     color differ per face); when indexing helps.
- Example checks: put the calls in order; click the boxes aColor reads for
  vertex 2; choose the right stride; click which vertex an index means.
- Before building: propose the files and stage details to the instructor
  and wait for approval.

## Ideas for later
- Other primitives (`TRIANGLE_STRIP`, `LINES`) to show how the same
  indices are grouped differently.
- `UNSIGNED_BYTE` colors with `normalized = true`.
- Editing vertex values directly in the memory picture.
