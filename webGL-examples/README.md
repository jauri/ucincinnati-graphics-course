# WebGL Examples

Teaching examples for an introductory computer graphics course. Each one
is plain WebGL with no libraries and no build step, and is commented line
by line for students who are new to WebGL.

## Running the examples
Open the `.html` file in a browser. Double-clicking it is enough; no web
server is needed.

## Examples

| Example | What it shows | Open |
|---|---|---|
| [cube-grid](examples/cube-grid/) | A grid of cubes with random heights and colors: shaders, buffers, attributes, uniforms, model/view/projection matrices | `index.html` |
| [camera-move](examples/camera-move/) | A camera orbiting a still scene: the view matrix (`lookAt`), perspective, the animation loop | `index.html` |
| [cube-color-alternatives](examples/cube-color-alternatives/) | Five ways to color a cube: uniform vs. attribute, per-face colors, interpolated corner colors, interpolation done in the fragment shader | `1-solid-uniform.html` (use the tabs) |

## Self-check quizzes
cube-grid and camera-move each have a quiz in `quiz-selfcheck/`. Open its
`index.html`. The quiz starts with an "explore the code" page, then asks
students to summarize, self-check, match comments to lines, and answer
multiple-choice questions. Nothing is scored.

## For instructors and Claude
- `CLAUDE.md`: conventions for all examples (style, terminology, testing)
- `notes/quizzes.md`: how to build a quiz for a new example
- `examples/<name>/CLAUDE.md` and `NOTES.md`: per-example details and history
