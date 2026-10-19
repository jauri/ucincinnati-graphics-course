# Tool: 2D Bézier curve playground (bezier-curve-playground-2d)

Students choose a quadratic or cubic Bézier curve, click to place its
control points, and drag them to see how the curve changes. History is in
`NOTES.md`.

**Main teaching point: how the control points shape the curve.** Also:
the curve passes through the first and last points only; the first and
last control-polygon segments are the end tangents; B(t) as a weighted
sum (Bernstein form) and as repeated lerps (de Casteljau); the derivative
B'(t) as the tangent direction.

## Files
- `index.html`: side panel (curve type, status, Clear, t slider, two
  checkboxes, legend, coordinate readout) and the canvas.
- `index.js`, in 7 sections:
  1. Canvas setup and high-DPI sizing (`resizeCanvas`).
  2. State: `degree`, `points`, `t`, `dragIndex`.
  3. Math: `bezierPoint` (Bernstein form), `bezierDerivative`, `lerp`,
     `deCasteljauLevels`.
  4. Pointer input: click empty space to add the next point, drag any
     point (pointer capture, clamped to the canvas).
  5. Drawing helpers (`strokePolyline`, `fillCircle`, `drawGrid`).
  6. `draw()`: grid, dashed control polygon, curve (100 segments),
     de Casteljau levels, dotted tangent through B(t), B(t), labeled
     control points.
  7. Panel: status line, readout (P0…Pn, t, B(t), B'(t), |B'(t)|), control
     handlers.

## Behavior details
- Coordinates are canvas CSS pixels, origin top-left, y down.
- Cubic → quadratic keeps the first three points; quadratic → cubic keeps
  all three and asks for P3.
- The tangent is skipped when |B'(t)| is about 0 (e.g. t = 0 with P1 on
  top of P0).
- No animation loop: everything redraws after each input.

## Open issues
- Not yet checked by a person in a browser, including dragging by hand.
