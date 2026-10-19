// =============================================================================
// index.js — An interactive 2D Bézier curve playground, using Canvas 2D.
//
// THE BIG IDEA
// ------------
// A Bézier curve is defined by a few CONTROL POINTS. The curve starts at the
// first point and ends at the last one; the points in between pull the curve
// toward them but (usually) are not on it.
//
//   Quadratic (degree 2): 3 control points P0, P1, P2
//   Cubic     (degree 3): 4 control points P0, P1, P2, P3
//
// A parameter t runs from 0 to 1. Each value of t gives one point B(t) on
// the curve: B(0) = P0 (the first point), B(1) = the last point.
//
// WHAT THIS TOOL DRAWS
// --------------------
//   - The control polygon (dashed gray): lines joining the control points
//     in order. Its first and last segments are the curve's tangent
//     directions at t = 0 and t = 1.
//   - The curve itself (blue), drawn by evaluating B(t) at many values of t
//     and joining the results with short straight lines.
//   - The de Casteljau construction at the slider's t (orange): repeated
//     linear interpolation between the control points, which ends at B(t).
//   - The tangent line at B(t) (dotted red), in the direction of the
//     derivative B'(t).
//
// We compute every point ourselves instead of calling the canvas's built-in
// quadraticCurveTo / bezierCurveTo, so that all the math is visible.
//
// FILE OUTLINE
//   Section 1. Set up the canvas (and its size on high-DPI screens).
//   Section 2. The program state: curve degree, control points, t.
//   Section 3. Bézier math: evaluate B(t), its derivative, de Casteljau.
//   Section 4. Mouse input: click to add points, drag to move them.
//   Section 5. Drawing helpers.
//   Section 6. Draw one frame.
//   Section 7. The side panel: controls and the coordinate readout.
// =============================================================================


// -----------------------------------------------------------------------------
// Section 1. Set up the canvas.
// -----------------------------------------------------------------------------
// A canvas has TWO sizes:
//   - its CSS size: how big it looks on the page (set by the stylesheet);
//   - its drawing-buffer size: how many pixels we actually draw into
//     (canvas.width and canvas.height).
// If they differ, the browser scales the image and it looks blurry. On a
// high-DPI ("Retina") screen, one CSS pixel covers several screen pixels
// (window.devicePixelRatio, often 2), so we make the drawing buffer that
// much bigger, then scale the context so we can keep thinking in CSS pixels.

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');   // The Canvas 2D drawing API.

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  // clientWidth/clientHeight are the canvas's on-screen size in CSS pixels.
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  // From now on, 1 unit in our drawing commands = 1 CSS pixel.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}


// -----------------------------------------------------------------------------
// Section 2. The program state.
// -----------------------------------------------------------------------------
// Everything the picture depends on lives in these few variables. Every
// event handler changes them and then calls draw() to redraw from scratch.

let degree = 3;        // 2 = quadratic, 3 = cubic.
let points = [];       // Control points placed so far: [{x, y}, ...].
let t = 0.5;           // The parameter shown by the slider, in [0, 1].
let dragIndex = -1;    // Index of the point being dragged, or -1 if none.

// A Bézier curve of degree n has n + 1 control points.
function pointsNeeded() {
  return degree + 1;
}

function curveIsComplete() {
  return points.length === pointsNeeded();
}


// -----------------------------------------------------------------------------
// Section 3. Bézier math.
// -----------------------------------------------------------------------------
// A Bézier curve is a weighted sum of its control points. The weights are
// the Bernstein polynomials of t, which are never negative and always add
// up to 1 (so B(t) is an average of the control points):
//
//   Quadratic:  B(t) = (1-t)² P0 + 2(1-t)t P1 + t² P2
//   Cubic:      B(t) = (1-t)³ P0 + 3(1-t)²t P1 + 3(1-t)t² P2 + t³ P3
//
// The derivative B'(t) points along the curve (the tangent direction):
//
//   Quadratic:  B'(t) = 2[(1-t)(P1-P0) + t(P2-P1)]
//   Cubic:      B'(t) = 3[(1-t)²(P1-P0) + 2(1-t)t(P2-P1) + t²(P3-P2)]
//
// At t = 0 this is a multiple of P1 - P0, and at t = 1 a multiple of the
// last control-polygon segment. That is why the first and last segments of
// the control polygon are the tangent directions at the two ends of the
// curve (when those two points are not on top of each other).

// Evaluate B(t) with the Bernstein form above.
function bezierPoint(p, t) {
  const s = 1 - t;  // Short name for (1 - t).
  if (p.length === 3) {
    const w0 = s * s, w1 = 2 * s * t, w2 = t * t;
    return {
      x: w0 * p[0].x + w1 * p[1].x + w2 * p[2].x,
      y: w0 * p[0].y + w1 * p[1].y + w2 * p[2].y,
    };
  }
  const w0 = s * s * s, w1 = 3 * s * s * t, w2 = 3 * s * t * t, w3 = t * t * t;
  return {
    x: w0 * p[0].x + w1 * p[1].x + w2 * p[2].x + w3 * p[3].x,
    y: w0 * p[0].y + w1 * p[1].y + w2 * p[2].y + w3 * p[3].y,
  };
}

// Evaluate the derivative B'(t). The result is a vector (a direction and a
// speed), not a point.
function bezierDerivative(p, t) {
  const s = 1 - t;
  if (p.length === 3) {
    return {
      x: 2 * (s * (p[1].x - p[0].x) + t * (p[2].x - p[1].x)),
      y: 2 * (s * (p[1].y - p[0].y) + t * (p[2].y - p[1].y)),
    };
  }
  const w0 = s * s, w1 = 2 * s * t, w2 = t * t;
  return {
    x: 3 * (w0 * (p[1].x - p[0].x) + w1 * (p[2].x - p[1].x) + w2 * (p[3].x - p[2].x)),
    y: 3 * (w0 * (p[1].y - p[0].y) + w1 * (p[2].y - p[1].y) + w2 * (p[3].y - p[2].y)),
  };
}

// Linear interpolation: the point a fraction t of the way from a to b.
function lerp(a, b, t) {
  return { x: (1 - t) * a.x + t * b.x, y: (1 - t) * a.y + t * b.y };
}

// The de Casteljau algorithm: a second way to find B(t), using only lerp.
// Take the control points, lerp each neighboring pair by t to get one fewer
// point, and repeat until one point is left. That last point is B(t).
//
// We return every level so we can draw the construction:
//   levels[0] = the control points          (4 points for a cubic)
//   levels[1] = lerps of those              (3 points)
//   levels[2] = lerps of those              (2 points)
//   levels[3] = the single point B(t)       (1 point)
//
// The segment joining the two points of the second-to-last level touches
// the curve at B(t): it lies along the tangent. (Its length times the
// degree equals |B'(t)|.)
function deCasteljauLevels(p, t) {
  const levels = [p];
  let current = p;
  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length - 1; i++) {
      next.push(lerp(current[i], current[i + 1], t));
    }
    levels.push(next);
    current = next;
  }
  return levels;
}


// -----------------------------------------------------------------------------
// Section 4. Mouse input.
// -----------------------------------------------------------------------------
// We use "pointer" events, which work for a mouse, a pen, and touch.
//   pointerdown on a point   -> start dragging it
//   pointerdown elsewhere    -> add a new control point (if more are needed)
//   pointermove while held   -> move the dragged point
//   pointerup                -> stop dragging

const HIT_RADIUS = 12;  // How close (in CSS pixels) a click must be to grab a point.

// Convert the event's position to canvas coordinates in CSS pixels.
// clientX/clientY are measured from the window's top-left corner;
// getBoundingClientRect() tells us where the canvas is in the window.
function eventToCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

// Return the index of the control point under (x, y), or -1 if none.
// We search from the last point backward, so the point drawn on top wins.
function findPointAt(pos) {
  for (let i = points.length - 1; i >= 0; i--) {
    if (Math.hypot(points[i].x - pos.x, points[i].y - pos.y) <= HIT_RADIUS) {
      return i;
    }
  }
  return -1;
}

canvas.addEventListener('pointerdown', (event) => {
  const pos = eventToCanvas(event);
  const hit = findPointAt(pos);
  if (hit >= 0) {
    dragIndex = hit;
  } else if (!curveIsComplete()) {
    points.push(pos);
    dragIndex = points.length - 1;  // Let the student drag the new point right away.
  } else {
    return;  // All points placed and none clicked: nothing to do.
  }
  // Keep receiving move events even if the pointer leaves the canvas.
  canvas.setPointerCapture(event.pointerId);
  update();
});

canvas.addEventListener('pointermove', (event) => {
  const pos = eventToCanvas(event);
  if (dragIndex >= 0) {
    // Keep the point inside the visible canvas.
    points[dragIndex] = {
      x: Math.min(Math.max(pos.x, 0), canvas.clientWidth),
      y: Math.min(Math.max(pos.y, 0), canvas.clientHeight),
    };
    update();
  } else {
    // Show a "grab" cursor when hovering over a point.
    canvas.style.cursor = findPointAt(pos) >= 0 ? 'grab' : 'crosshair';
  }
});

function endDrag() {
  dragIndex = -1;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);


// -----------------------------------------------------------------------------
// Section 5. Drawing helpers.
// -----------------------------------------------------------------------------
// Canvas 2D draws with "paths": beginPath(), then moveTo/lineTo to trace
// the shape, then stroke() to draw its outline (or fill() to fill it).
// setLineDash([dash, gap]) makes the next strokes dashed; [] makes them solid.

const COLORS = {
  polygon: '#888888',       // Control polygon.
  curve: '#1f5fbf',         // The Bézier curve.
  construction: '#e08a00',  // de Casteljau levels.
  tangent: '#c0262d',       // Tangent at t.
  point: '#222222',         // Control points.
  curvePoint: '#c0262d',    // B(t).
};

// Draw a polyline through the given points.
function strokePolyline(pts, color, width, dash) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Draw a filled circle.
function fillCircle(p, radius, color) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

// Draw a light background grid every 50 CSS pixels, to help read positions.
function drawGrid(width, height) {
  ctx.strokeStyle = '#ececec';
  ctx.lineWidth = 1;
  ctx.beginPath();
  // The +0.5 puts each 1-pixel line in the middle of a pixel, so it stays sharp.
  for (let x = 0; x <= width; x += 50) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = 0; y <= height; y += 50) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }
  ctx.stroke();
}


// -----------------------------------------------------------------------------
// Section 6. Draw one frame.
// -----------------------------------------------------------------------------
// We redraw everything from scratch each time something changes. There is
// no animation loop: draw() is only called after input.

const CURVE_SEGMENTS = 100;  // How many straight pieces approximate the curve.
const TANGENT_HALF_LENGTH = 2000;  // Long enough to cross the whole canvas.

function draw() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // Clear to white, then draw the grid.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  drawGrid(width, height);

  // 1. The control polygon, dashed. Drawn even while points are still
  //    being placed, so students see the order they clicked in.
  strokePolyline(points, COLORS.polygon, 1.5, [6, 5]);

  if (curveIsComplete()) {
    // 2. The curve: sample B(t) at t = 0, 1/N, 2/N, ..., 1 and join the
    //    samples with straight lines. With enough samples it looks smooth.
    const samples = [];
    for (let i = 0; i <= CURVE_SEGMENTS; i++) {
      samples.push(bezierPoint(points, i / CURVE_SEGMENTS));
    }
    strokePolyline(samples, COLORS.curve, 3, []);

    const levels = deCasteljauLevels(points, t);
    const pointOnCurve = bezierPoint(points, t);

    // 3. The de Casteljau construction. Skip levels[0] (the control
    //    polygon, already drawn) and the last level (the single point B(t)).
    if (document.getElementById('show-construction').checked) {
      for (let k = 1; k < levels.length - 1; k++) {
        strokePolyline(levels[k], COLORS.construction, 1.5, []);
        for (const q of levels[k]) {
          fillCircle(q, 3.5, COLORS.construction);
        }
      }
    }

    // 4. The tangent at B(t): a dotted line through B(t) in the direction
    //    of B'(t). We normalize B'(t) (divide by its length) to get a unit
    //    direction, then go a long way in both directions.
    if (document.getElementById('show-tangent').checked) {
      const d = bezierDerivative(points, t);
      const len = Math.hypot(d.x, d.y);
      // If B'(t) is (almost) the zero vector, the direction is undefined
      // (this happens, e.g., at t = 0 when P1 is on top of P0). Skip it.
      if (len > 1e-6) {
        const ux = d.x / len, uy = d.y / len;
        strokePolyline([
          { x: pointOnCurve.x - ux * TANGENT_HALF_LENGTH, y: pointOnCurve.y - uy * TANGENT_HALF_LENGTH },
          { x: pointOnCurve.x + ux * TANGENT_HALF_LENGTH, y: pointOnCurve.y + uy * TANGENT_HALF_LENGTH },
        ], COLORS.tangent, 1.5, [2, 4]);
      }
    }

    // 5. The point B(t) itself.
    fillCircle(pointOnCurve, 6, COLORS.curvePoint);
  }

  // 6. The control points and their labels, drawn last so they are on top.
  ctx.font = '14px system-ui, sans-serif';
  ctx.textBaseline = 'bottom';
  points.forEach((p, i) => {
    fillCircle(p, 7, '#ffffff');               // White ring for contrast.
    fillCircle(p, 5.5, COLORS.point);
    ctx.fillStyle = COLORS.point;
    ctx.fillText('P' + i, p.x + 9, p.y - 6);
  });
}


// -----------------------------------------------------------------------------
// Section 7. The side panel: controls and the coordinate readout.
// -----------------------------------------------------------------------------

const statusEl = document.getElementById('status');
const readoutEl = document.getElementById('readout');
const tSlider = document.getElementById('t-slider');
const tValueEl = document.getElementById('t-value');

// Format a point as "(123.0, 45.6)".
function fmt(p) {
  return '(' + p.x.toFixed(1) + ', ' + p.y.toFixed(1) + ')';
}

// Update the status line and the coordinate readout.
function updatePanel() {
  const remaining = pointsNeeded() - points.length;
  if (remaining > 0) {
    statusEl.textContent = 'Click to place P' + points.length +
      ' (' + remaining + ' more to go).';
  } else {
    statusEl.textContent = 'Curve complete. Drag the points to change it.';
  }

  const lines = [];
  for (let i = 0; i < pointsNeeded(); i++) {
    lines.push('P' + i + '    = ' + (i < points.length ? fmt(points[i]) : '—'));
  }
  if (curveIsComplete()) {
    const d = bezierDerivative(points, t);
    lines.push('');
    lines.push('t     = ' + t.toFixed(2));
    lines.push('B(t)  = ' + fmt(bezierPoint(points, t)));
    lines.push("B'(t) = " + fmt(d));
    lines.push("|B'(t)| = " + Math.hypot(d.x, d.y).toFixed(1));
  }
  readoutEl.textContent = lines.join('\n');
}

// Redraw the canvas and the panel. Called after every change.
function update() {
  draw();
  updatePanel();
}

// Curve type. Switching from cubic to quadratic keeps only the first three
// points; switching from quadratic to cubic keeps all three and asks for
// one more.
document.querySelectorAll('input[name="degree"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    degree = Number(radio.value);
    points = points.slice(0, pointsNeeded());
    update();
  });
});

tSlider.addEventListener('input', () => {
  t = Number(tSlider.value);
  tValueEl.textContent = t.toFixed(2);
  update();
});

document.getElementById('show-construction').addEventListener('change', update);
document.getElementById('show-tangent').addEventListener('change', update);

document.getElementById('clear').addEventListener('click', () => {
  points = [];
  update();
});

// Redraw when the window changes size, and once now to start.
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
updatePanel();
