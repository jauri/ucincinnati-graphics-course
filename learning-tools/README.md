# Learning Tools

Interactive tools for a computer graphics course. Students change the
inputs and see the result right away. Each tool is plain JavaScript and
the Canvas 2D API, with no libraries and no build step.

## Running the tools
Open the tool's `index.html` in a browser. Double-clicking it is enough;
no web server is needed.

## Tools

| Tool | What it shows | Open |
|---|---|---|
| [bezier-curve-playground-2d](bezier-curve-playground-2d/) | Quadratic and cubic Bézier curves: click to place control points, drag them, see the control polygon (end tangents), the de Casteljau construction, and the tangent at any t | `index.html` |
| [bezier-subdivision-guided](bezier-subdivision-guided/) | A guided activity: students cut a cubic Bézier curve in two with midpoints (de Casteljau at t = ½), find the control points of the pieces, compare stopping rules, trace the recursion, and write the algorithm in pseudocode | `index.html` |
| [webgl-buffers-playground](webgl-buffers-playground/) | How WebGL reads vertex buffers: change the arguments of `bindBuffer`, `vertexAttribPointer`, `drawArrays` and `drawElements`, see which bytes each attribute reads for each vertex (offset + vertex × stride), the index buffer, WebGL's state and errors, and what real WebGL 2 draws | `index.html` |
| [webgl-vertex-id-playground](webgl-vertex-id-playground/) | What shaders can see of a vertex's number: `gl_VertexID` with `drawArrays` (first + k) and `drawElements` (the index value), shared vertices, interpolated vs `flat` outputs and the provoking vertex, faking a triangle number, and the barycentric wireframe trick, with real WebGL 2 and a fragment inspector that compares a hand calculation with the drawn pixel | `index.html` |
| [webgl-camera-playground](webgl-camera-playground/) | The WebGL camera: set `lookAt(eye, target, up)` and the lens (vertical field of view, aspect ratio, near, far) with sliders, see the camera from outside (its axes, up vector and view frustum) and what it sees, and the camera setup code with live numbers, including inside `lookAt`, `perspective`, and the 16 floats `uniformMatrix4fv` sends | `index.html` |
| [triangle-drawing-modes](triangle-drawing-modes/) | Six ways to draw triangles in WebGL 2: `drawArrays` and `drawElements` with `TRIANGLES`, `TRIANGLE_STRIP` and `TRIANGLE_FAN`, each with its code, what WebGL draws, the vertices in clip space, and how the draw call groups the buffer (or index buffer) into triangles | `index.html` |
| [normal-matrix-scaling](normal-matrix-scaling/) | Why normals need the normal matrix: two spheres scaled by the same sliders, one transforming its normals with the model matrix and one with (M⁻¹)ᵀ, with the normals drawn and colored by their error, shading, the code for both, and a 7-step derivation of the inverse transpose | `index.html` |
| [cube-color-code-explorer](cube-color-code-explorer/) | A code explorer for “Ways to Color a Cube” tab 5 (custom interpolation) and tab 6 (per-triangle rules), with a switch between them: the whole program on one side, the same cube on the other. Click the cube to trace one fragment through the code (barycentric coordinates, flat colors, in tab 6 the triangle number from `gl_VertexID`, the branch of `interpolate()` it takes, lighting, and the pixel `readPixels` returns); click an underlined line to see it on the cube | `index.html` |
| [cube-color-code-walkthrough](cube-color-code-walkthrough/) | A step-by-step walkthrough of the same two programs (tab 5, or tab 6 with a switch): one function or action per step, with everything else folded, a short explanation, a picture made for that step (attribute layouts, smooth vs `flat` outputs, each interpolation rule drawn pixel by pixel, stride and offsets, the pipeline), and a live cube set up for the step. Prev / Next, arrow keys, and a section list with a dot per step | `index.html` |

## For instructors and Claude
- `CLAUDE.md`: conventions for all tools
- `<tool>/CLAUDE.md` and `NOTES.md`: per-tool details and history
