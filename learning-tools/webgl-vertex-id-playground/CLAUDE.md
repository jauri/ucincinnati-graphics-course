# Tool: WebGL vertex ID playground (webgl-vertex-id-playground)

Students change the draw call (`drawArrays` first/count, or
`drawElements` with an editable index buffer), what the vertex shader
does with `gl_VertexID`, and how the fragment shader receives the result
(interpolated, `flat`, or as edges). They see which vertex each step
fetches, the vertex shader's outputs, what real WebGL 2 draws, and, for
a clicked point, what the fragment shader received. History is in
`NOTES.md`. A guided activity is planned (see `NOTES.md`).

**Main teaching point: `gl_VertexID` is the number of the vertex the
step fetched: `first + k` for `drawArrays`, the value `indices[k]` for
`drawElements` (not k). The fragment shader never sees it; it only gets
outputs, interpolated or `flat` (from the triangle's last vertex, the
provoking vertex).** Also: shared vertices give identical outputs (why
per-face effects need duplicated vertices); WebGL 2 has no
`gl_PrimitiveID`; `gl_VertexID / 3` and the barycentric `% 3` trick work
only when vertices are numbered in triangle order (`drawArrays`).

## Design: hybrid simulation + real WebGL
- Section 3 of `index.js` is a JS copy: steps → vertex numbers, the
  vertex shader (`vertexShaderJS`, mirrors the GLSL in section 4), and one
  fragment (`simulateFragment`: barycentric coordinates, interpolated and
  flat values, the edges shader with fwidth estimated from neighbor pixels).
- Section 5 draws with real WebGL 2. The inspector reads the clicked pixel
  back (`preserveDrawingBuffer: true` + `readPixels`) and compares it with
  the JS prediction.
- Shaders are built as lists of lines (section 4); the page shows the
  exact compiled source, with the lines that depend on the choices
  highlighted. One program per (vertex choice, fragment choice), cached.
  The output qualifier (`flat out`) follows the fragment choice, because
  GLSL ES 3.00 requires matching interpolation qualifiers.
- Attribute locations are fixed with `bindAttribLocation` (0, 1). Each run
  makes a fresh VAO (housekeeping, not shown to students).
- Buffer setup calls are not listed; the buffer playground covers them.
- Memory picture: my own copy of the buffer playground's box style
  (self-contained, no shared file), simplified to float boxes per vertex.

## Files
- `index.html`: side panel (preset, draw call + index editor, vertex
  shader choice, fragment shader choice, step buttons, "good to know"
  notes) and main area (memory, result + overlay, inspector, runs table,
  both shaders, the draw call). All CSS.
- `index.js`, in 9 sections: colors and presets, state, simulator,
  shader source, real WebGL 2, memory picture, overlay and inspector,
  other views, side panel and `update()`.

## Presets
1. Triangle, `drawArrays(0, 3)`, color by ID.
2. 6-vertex square, `drawArrays(first 3, count 3)`: IDs 3, 4, 5.
3. Square with `drawArrays`: duplicated corners get two IDs (seam).
4. Square indexed `0 1 2 0 2 3`: ID = index value; no seam.
5. `flat`, indices `0 1 2 3 0 2`: both triangles end on vertex 2 → one
   color; students reorder.
6. 2×2 grid, `drawArrays`, `gl_VertexID / 3` flat: triangle numbers.
7. Same grid indexed: `/ 3` gives the row, colors repeat.
8. Grid `drawArrays`, barycentric + edges: a correct wireframe.
9. Indexed hexagon fan, barycentric + edges: triangles 0 1 2 and 0 4 5
   show edges, the other 4 are solid black (one component 0 everywhere).
   (The 2×2 grid was tried first: every triangle broke, all black.)

## Behavior details
- Checked in Chrome: all 12 shader pairs compile; for every preset and
  every pair, the JS prediction matched `readPixels` within 3/255 at ~360
  sample points, except points exactly on a triangle edge or on a line's
  boundary in edges mode.
- An index past the vertex buffer → Chrome refuses the draw
  (`INVALID_OPERATION`); count past the index buffer → `INVALID_OPERATION`.
  The words come from `drawProblems`.
- Only `TRIANGLES`, `UNSIGNED_SHORT` indices, element offset 0.

## Open issues
- Not yet tried by a person; only scripted checks in Chrome.
- Edge lines are thin (about 1–2 device pixels).
