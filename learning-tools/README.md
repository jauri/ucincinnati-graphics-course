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

## For instructors and Claude
- `CLAUDE.md`: conventions for all tools
- `<tool>/CLAUDE.md` and `NOTES.md`: per-tool details and history
