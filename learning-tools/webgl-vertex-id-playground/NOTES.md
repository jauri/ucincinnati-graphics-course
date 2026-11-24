# WebGL vertex ID playground: notes

## 2026-11-23: first version
- Committed and pushed 2026-11-24 (commit 378a5ab).
- Planned with the instructor after brainstorming a vertex-indexing
  activity. Decisions (asked in a dialog):
  - Scope: `gl_VertexID` (arrays vs elements), shared vertices, smooth vs
    flat, provoking vertex, faking a triangle ID, barycentric wireframe.
    Geometry from `gl_VertexID` alone and `gl_InstanceID` are left for a
    later tool.
  - Playground first; guided activity planned below.
  - Memory picture in the buffer playground's style, as an own copy.
  - WebGL 2's last-vertex convention only; `WEBGL_provoking_vertex` is
    mentioned in one line.
- Hybrid design like the buffer playground, plus a fragment inspector
  that compares the JS prediction with `readPixels`.
- Found in testing: the indexed 2×2 grid broke every triangle in the
  wireframe preset (corner number % 3 = column, so each triangle has two
  equal values) and drew a solid black square. Replaced it with a hexagon
  fan, where 2 of 6 triangles work, so the failure is visible by contrast.

## Next: the guided activity (webgl-vertex-id-guided), draft plan
- Separate self-contained folder with `index.html`, `index.js`,
  `stages.js`, `CLAUDE.md`, `NOTES.md`, like `bezier-subdivision-guided`.
  No typed answers: clicks, choices, ordering; misses go on a review list.
- Stages:
  1. `drawArrays`, first 0 then first 3: click the color each vertex gets.
  2. Indexed square: for step 4, click the `gl_VertexID` the shader sees
     (distractor: 4).
  3. Shared corners: predict which corners match, check on the render.
  4. Interpolation: click a point, choose the range of the interpolated
     ID (formula shown, not asked).
  5. `flat`: the square is one color; reorder the indices so the
     triangles differ (ordering task).
  6. Triangle number `/ 3`: works with `drawArrays`, choose why it fails
     indexed.
  7. Wireframe: works with `drawArrays`; on the hexagon, click the
     triangles that will turn black before revealing.
- Before building: propose files and stage details to the instructor
  and wait for approval.

## Ideas for later
- A second tool: geometry from `gl_VertexID` alone (circle with
  `TRIANGLE_FAN`, full-screen triangle) and `gl_InstanceID` with
  `drawArraysInstanced`.
- Picking: draw IDs as colors, read them back with `readPixels`.
