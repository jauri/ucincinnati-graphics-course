# Example: ways to color a cube (cube-color-alternatives)

Five pages, linked by a tab bar. Each shows the same rotating, lit cube
colored a different way. WebGL 1 for now (see the root `CLAUDE.md`). The
original plan and the build history are in `NOTES.md`.

**Main teaching point:** how a cube is colored is decided by the per-vertex
data you send and by how the rasterizer interpolates it. Interpolation
happens in every tab; you can only *see* it in Tab 4.

## Files

| File | Contents |
|------|----------|
| `1-solid-uniform.html` / `.js` | Color is `uniform vec3 uColor` = `CUBE_COLOR` (orange `[1.0, 0.5, 0.1]`), set with `gl.uniform3fv` in `draw()`. 6 floats per vertex, no color data. |
| `2-solid-attribute.html` / `.js` | All 36 vertices carry `CUBE_COLOR` as an attribute. Same picture as Tab 1 (verified pixel-identical). |
| `3-face-colors.html` / `.js` | One color per face: front RED, back CYAN, top GREEN, bottom MAGENTA, right BLUE, left YELLOW (opposite faces are complementary). |
| `4-vertex-interpolation.html` / `.js` | RGB color cube: cube corner (x,y,z) → color (x+0.5, y+0.5, z+0.5), named BLACK…WHITE. |
| `5-custom-interpolation.html` / `.js` | Same colors as Tab 4, interpolated in the fragment shader, with a dropdown of interpolation rules. |

Each `.js` file is a complete program on its own. About 95% of the code is
duplicated **on purpose**, so a student can read one file top to bottom and
the diffs between tabs stay clean. Don't factor out a shared file.

JS sections in every file: 0 context, 1 shaders, 2 geometry/buffer,
3 matrix helpers, 4 draw, 5 animate.

## IMPORTANT: which files must stay in sync

Each neighboring diff is meant to show exactly one idea:

| Diff | Should show only |
|------|------------------|
| `diff 1-solid-uniform.js 2-solid-attribute.js` | the uniform → attribute change: header, shader color lines, 6 → 9 floats, `aColor` pointer, `uColor` lookup and `gl.uniform3fv` |
| `diff 2-solid-attribute.js 3-face-colors.js` | header, section-2 color comments, color constants, color column |
| `diff 3-face-colors.js 4-vertex-interpolation.js` | same as above |
| `diff 4-vertex-interpolation.js 5-custom-interpolation.js` | everything that moves interpolation into the shader |

- **Files 2, 3 and 4 share all code and all comments outside the header
  and section 2.** Any change there must be made identically in all three.
- File 1 is a copy of file 2 with the uniform changes, so shared changes
  (matrices, draw, animate, section 1's variable list) usually belong in it
  too.
- All 10 shader strings carry the GLSL markers (`// language=GLSL`,
  `/* glsl */`; see the root `CLAUDE.md`), and section 1's header ends
  with the same note about them in all five files. Keep both identical
  across files so they never show up in the diffs.
- File 5 started as a copy of file 4 and shares the matrix, draw and
  animate code.
- For a shared change, edit each file by hand or with a small script, then
  check with the diffs above.

The HTML pages differ only in the highlighted tab (`class="current"`), the
`<title>`, the header comment's page number, the caption `<div>`, and the
`<script src>`. Page 5 also has the interpolation-rule `<select>` and its
CSS.

## Tab 5 details
- Section 2 keeps Tab 4's exact 9-float `cubeVertices` array. A loop
  rebuilds it into `vertexData` with 18 floats per vertex: pos, normal,
  `aBary`, `aColor0`, `aColor1`, `aColor2`. Stride is 72 bytes.
- The six attributes are hooked up by a small `connectAttribute(name,
  offsetInFloats)` helper.
- No `flat` and no extensions (WebGL 1). The corner colors reach the
  fragment shader unchanged because all 3 vertices of a triangle carry the
  same values. **Revisit when porting to WebGL 2**, which has `flat`.
- Fragment shader: `uniform int uMode` picks a case in
  `interpolate(b, c0, c1, c2)`: 0 linear, 1 nearest vertex, 2 sharpened
  (pow 4, renormalized), 3 bands (floor to 1/4 steps, renormalized),
  4 wireframe (min λ < 0.02 → near black). An unknown mode returns bright
  pink. Rule 0 must look like Tab 4.
- `draw()` reads `<select id="mode">` every frame and calls
  `gl.uniform1i(uMode, …)`. There are no event listeners.
- Names: the constant is `BARY_COORDS`; rule 1 is "Nearest vertex".
- Section 2 of Tabs 4 and 5 has a short "interpolation is not blending"
  warning (see Terminology in the root `CLAUDE.md`).

## Testing (beyond the root `CLAUDE.md`)
- Open `1-solid-uniform.html` first and click through the tabs.
- To compare two tabs pixel by pixel: load both pages in same-origin
  iframes, give each canvas a fixed CSS size (e.g. 300×300), call
  `draw(1.0)`, then `gl.readPixels` right away (same task, so the drawing
  buffer is still there).
- Last verified 2026-10-15: all five pages compile and link with no console
  errors, every tab link resolves, and Tabs 1 and 2 are pixel-identical at
  the same angle.

## Open issues
- The code comments in all five `.js` files refer to `example-cube.js`
  ("the same numbered order as example-cube.js", "as in example-cube.js").
  That file was removed on 2026-10-16. The comments should be reworded or
  pointed at another example (cube-grid's `index.js` has the same
  structure).
- No quiz yet.
