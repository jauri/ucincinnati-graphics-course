# Tool: WebGL buffer playground (webgl-buffers-playground)

Students change the arguments of the WebGL buffer calls
(`bindBuffer`, `vertexAttribPointer`, `enable/disableVertexAttribArray`,
`drawArrays`, `drawElements`) and see which bytes each attribute reads for
each vertex, and what real WebGL draws. History is in `NOTES.md`. A guided
activity (`webgl-buffers-guided`) is planned to reuse this tool's engine.

**Main teaching point: a buffer is just bytes; `vertexAttribPointer`
tells WebGL how to cut them into per-vertex values with one rule,
first byte = offset + vertex × stride (in bytes).** Also: stride 0 means
tightly packed; `vertexAttribPointer` saves the buffer bound at that
moment; disabled attributes use a constant; missing components are
filled with 0, 0, 0, 1; an index buffer supplies the vertex numbers for
`drawElements`; WebGL's validation rules (alignment, ranges).

## Design: hybrid simulation + real WebGL
- Section 3 of `index.js` is a JS copy of the GPU's attribute fetch
  (reads with a `DataView`). It drives the memory picture, the step
  explanation, the inputs table, and the vertex labels on the result.
- Section 5 runs the same calls with real **WebGL 2** on the same typed
  arrays, checking `gl.getError()` after every call. The listing shows
  exactly the calls that ran; error codes always come from WebGL, and
  section 4 (`pointerProblems`, `drawProblems`) only supplies the words.
- The WebGL state table is queried from WebGL (`getParameter`,
  `getVertexAttrib`, `getVertexAttribOffset`), not from our state.
- Each run creates a fresh VAO (housekeeping, explained in a comment and
  not shown in the listing) so refused calls can't leave old settings.
  Students have not been taught VAOs; keep them out of the listing.
- The shader declares both attributes `vec4` so the 0, 0, 0, 1 fill is
  visible. The fragment shader ignores alpha.

## Files
- `index.html`: side panel (preset, one fieldset per attribute, draw
  call, index editor, step buttons) and main area (memory canvas, result
  canvas + 2D overlay, inputs table, state table, calls listing). All CSS.
- `index.js`, in 8 sections: presets, state, simulator, WebGL's rules,
  real WebGL 2, memory picture, other views, side panel and `update()`.

## Presets
1. Triangle, positions only (aColor disabled → constant gray).
2. Triangle, colors in a second buffer.
3. Triangle, interleaved x, y, r, g, b (stride 20, color offset 8).
4. Square with `drawArrays` (6 vertices, 2 corners duplicated).
5. Square indexed with `drawElements` (4 vertices, indices 0 1 2 0 2 3).
6. Cube face in the course examples' layout (9 floats, stride 36,
   normal skipped).
7. Same face indexed; the note explains why the full cube can't share
   corners across faces.

## Behavior details
- Stride, offset, first, count, and index values are number inputs
  (it's a playground; "no typed answers" applies to guided activities).
- Behavior checked in Chrome (WebGL 2): misaligned stride/offset →
  `INVALID_OPERATION` on `vertexAttribPointer`, then the draw is refused
  because the enabled attribute has no buffer; reading past the end of a
  vertex buffer → `INVALID_OPERATION` on the draw; index range past the
  index buffer or an odd byte offset → `INVALID_OPERATION`. Other
  browsers may read zeros instead of refusing an out-of-range vertex
  fetch; the draw report covers that case.
- The memory picture shows up to 96 bytes past a buffer's end, dashed.
- Everything redraws (and WebGL re-runs) after each input.

## Open issues
- Not yet tried by a person; only scripted checks in Chrome.
- Only `gl.TRIANGLES`, `gl.FLOAT` attributes and `UNSIGNED_SHORT` indices.
