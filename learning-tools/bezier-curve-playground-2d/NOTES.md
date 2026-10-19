# 2D Bézier curve playground: notes

## 2026-10-19: first version
- Created the `learning-tools/` folder and this tool.
- Requested features: choose quadratic or cubic, click to place control
  points, see the curve and dotted tangent lines.
- Extras the instructor approved: a t slider with the de Casteljau
  construction, the tangent at t, and a coordinate readout.
- Added dragging of placed points, so students see the curve change live.
- Decision: the curve is sampled with our own `bezierPoint` rather than
  `bezierCurveTo`, so the math is visible.

## Ideas for later
- Show the Bernstein weights at t as a small bar chart.
- Higher-degree curves, or joining two cubics with C1 continuity.
- A self-check quiz, like the WebGL examples have.
