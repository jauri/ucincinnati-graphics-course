# Triangle drawing modes: notes

## 2026-10-30: planning and first version
- The instructor asked for an illustration of the six combinations of
  `drawArrays` / `drawElements` with `TRIANGLES`, `TRIANGLE_STRIP`,
  `TRIANGLE_FAN`: for each, the code that fills a small buffer and issues
  the draw call, the product, and an SVG picture of how the buffer is
  laid out in vertex coordinates, all visible at once, with tabs or one
  scrolling page. The guided camera activity was set aside for this.
- Instructor's choices: a shared shape per column (so vertex counts can
  be compared), the name `triangle-drawing-modes`.
- Decisions proposed by Claude and approved:
  - 2 × 3 tab grid plus a "Show all" toggle (both, since it's cheap).
  - Two SVG pictures: the buffers (with index → vertex lines and one row
    per triangle marking the list entries it uses, in order) and the
    vertices in clip space.
  - Indexed strip uses row-order vertices with indices 0 3 1 4 2, and
    the indexed fan stores the center last, so indexing has a real job.
  - Positions-only shader; outlines drawn by the page on an overlay.
  - Hover a triangle to highlight it in all three views.
- Added while building: the summary table (vertices, indices,
  triangles, bytes) and `fn.toString()` / Proxy recording so the code and
  pictures can't disagree.
- Fixed while testing: the address hash scrolled past the tabs (section
  ids now `case-…`); tick labels collided with vertex labels (ticks moved
  to the edges, only -1, 0, 1); wide tables at phone width now scroll in
  their own box.

## Ideas for later
- A guided version: predict the triangles from an index list, put
  indices in strip order, spot the swapped strip triangle.
- Show face culling (`gl.CULL_FACE`) to make the winding point visible.
- `LINES` / `LINE_STRIP` / `POINTS` with the same data.
- Primitive restart / degenerate triangles to join strips.
