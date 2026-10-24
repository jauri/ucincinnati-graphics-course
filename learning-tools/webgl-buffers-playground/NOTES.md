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

## Ideas for later
- Other primitives (`TRIANGLE_STRIP`, `LINES`) to show how the same
  indices are grouped differently.
- `UNSIGNED_BYTE` colors with `normalized = true`.
- Editing vertex values directly in the memory picture.
