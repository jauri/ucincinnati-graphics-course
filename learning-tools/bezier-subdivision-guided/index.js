// =============================================================================
// index.js — The engine for the guided activity "Cutting a Bézier curve in
// two". The activity's content (every step's text, questions, and answers)
// lives in stages.js; this file shows the steps, checks the answers, and
// draws the canvas.
//
// THE BIG IDEA
// ------------
// To draw a Bézier curve with straight lines, cut it into smaller Bézier
// curves until each piece is nearly straight. De Casteljau's algorithm
// cuts a curve at t: cut each segment of the control polygon at t, connect
// the new points, cut those segments at t, and so on until one point is
// left. With t = 1/2, every cut is at a midpoint. The control points of the
// two pieces are the two outer edges of the resulting triangle of points.
// Repeating this on each piece, until a stopping rule says a piece is
// close enough to a line segment, is a recursive algorithm.
//
// The student builds all of this by hand, one step at a time. There are no
// scores and no typed answers. Every answer (a point on the canvas, a choice
// of t, a list of control points, a multiple-choice answer, an order of
// lines) is checked automatically. Anything missed on the first try goes on
// a review list, shown at the end.
//
// FILE OUTLINE
//   Section 1. Set up the canvas, and map world coordinates to the screen.
//   Section 2. The program state.
//   Section 3. Bézier math: midpoints, de Casteljau, cutting, arc length.
//   Section 4. Recursive subdivision: stopping rules and the call trace.
//   Section 5. Drawing helpers.
//   Section 6. Draw one frame.
//   Section 7. The steps: show the current step and check answers.
//   Section 8. Canvas input: placing, connecting, picking, predicting.
//   Section 9. The side panel: triangle, stage buttons, start.
// =============================================================================


// -----------------------------------------------------------------------------
// Section 1. Set up the canvas, and map world coordinates to the screen.
// -----------------------------------------------------------------------------
// A canvas has TWO sizes: its CSS size (how big it looks on the page) and
// its drawing-buffer size (how many pixels we draw into). On a high-DPI
// screen, one CSS pixel covers window.devicePixelRatio screen pixels, so we
// make the drawing buffer that much bigger and scale the context, so that we
// can keep thinking in CSS pixels.
//
// The curve is defined in "world" units (a WORLD_WIDTH × WORLD_HEIGHT box,
// see stages.js). We scale that box to fit the canvas, keeping its shape,
// and center it. toScreen and toWorld convert between the two.

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const MARGIN = 30;  // Empty space around the world box, in CSS pixels.
const fit = { scale: 1, ox: 0, oy: 0 };  // screen = offset + world × scale

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
  // The stopping rules measure in screen pixels, so their readout changes.
  if (STEPS[stepIndex].type === 'explore-stop') updateStopReadout();
}

// Fit a world box { x, y, w, h } to the canvas: the largest scale at which
// it fits inside the margins, centered. Usually the box is the whole world;
// in stage 5 it is the piece Q, so its small construction is easy to see.
function updateFit(box) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  fit.scale = Math.max(0.1, Math.min((w - 2 * MARGIN) / box.w, (h - 2 * MARGIN) / box.h));
  fit.ox = (w - box.w * fit.scale) / 2 - box.x * fit.scale;
  fit.oy = (h - box.h * fit.scale) / 2 - box.y * fit.scale;
}

// The bounding box of some points, padded by a fraction of its size.
function paddedBox(pts, pad) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const size = Math.max(x1 - x0, y1 - y0);
  return { x: x0 - pad * size, y: y0 - pad * size, w: x1 - x0 + 2 * pad * size, h: y1 - y0 + 2 * pad * size };
}

function toScreen(p) {
  return { x: fit.ox + p.x * fit.scale, y: fit.oy + p.y * fit.scale };
}

function toWorld(s) {
  return { x: (s.x - fit.ox) / fit.scale, y: (s.y - fit.oy) / fit.scale };
}


// -----------------------------------------------------------------------------
// Section 2. The program state.
// -----------------------------------------------------------------------------
// Everything the picture depends on lives in these variables. Every event
// handler changes them, then calls draw() (and, if needed, renderStep()).

const CUT_T = 0.5;     // The t the student settles on in stage 1.
const MAX_DEPTH = 10;  // Safety net for every stopping rule.

let control = copyPoints(CONTROL_POINTS);  // The control points P0..P3.
let t = 0.3;             // The t on the stage 1 slider (starts away from 1/2).
let placed = new Set();  // Names of construction points the student placed.
let segments = [];       // Segments the student drew: [['P01', 'P12'], ...].
let picks = {};          // Finished picks: { L: [...names], R: ..., QL: ..., QR: ... }.
let chosenHalf = null;   // 'L' or 'R': the piece cut again in stage 5 (Q).
let stopRule = { name: 'flat', values: {} };  // Stage 6: the rule being tried.
let flatPath = '';       // Stage 6: the piece being judged ('' = whole curve, 'LR', ...).
let flatTol = null;      // Stage 6: its flatness tolerance, in world units.

let stepIndex = 0;       // Which step of STEPS is showing.
let stepDone = false;    // True once the step's task is finished (Next works).
let extraView = {};      // View flags added during the step (mc viewAfter).
let review = [];         // Items for the review list: [{ title, text }].

// Per-step scratch state. Reset at the start of each step.
let pending = [];        // connect: [first point]; pick: names so far.
let misses = 0;          // Wrong clicks or wrong attempts in this step.
let missedAt = null;     // World position of the last wrong click (drawn as ×).
let dragIndex = -1;      // Index of the control point being dragged, or -1.
let trace = null;        // Stage 7: { events, next, stack, lines, predictionsLeft }.

function copyPoints(pts) {
  return pts.map((p) => ({ x: p.x, y: p.y }));
}


// -----------------------------------------------------------------------------
// Section 3. Bézier math.
// -----------------------------------------------------------------------------

// The point a fraction t of the way from a to b. At t = 1/2 it is the
// midpoint of segment ab.
function lerp(a, b, t) {
  return { x: (1 - t) * a.x + t * b.x, y: (1 - t) * a.y + t * b.y };
}

// De Casteljau's construction at t. levels[0] is the control polygon; each
// next level cuts every segment of the previous level at t, so it has one
// fewer point. The last level is the single point B(t).
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

// The name of point i in level k of the triangle: a prefix ('P' or 'Q')
// and the control points it comes from. Level 1, point 0 is "P01"; level 3
// is "P0123".
function pointName(prefix, k, i) {
  let name = prefix;
  for (let j = i; j <= i + k; j++) name += j;
  return name;
}

// The level k and index i of a point, from its name: "P12" is level 1,
// index 1.
function pointLevel(name) {
  const digits = name.slice(1);
  return { k: digits.length - 1, i: Number(digits[0]) };
}

// Every point of the triangle at t, by name: { P0: {x, y}, P01: ..., ... }.
function namedPoints(p, t, prefix) {
  const named = {};
  deCasteljauLevels(p, t).forEach((level, k) => {
    level.forEach((q, i) => { named[pointName(prefix, k, i)] = q; });
  });
  return named;
}

// A point on the curve: the last point of de Casteljau's construction.
function bezierPoint(p, t) {
  const levels = deCasteljauLevels(p, t);
  return levels[levels.length - 1][0];
}

// Cut the curve at t. The first piece's control points run down the left
// edge of the triangle; the second piece's run up the right edge.
function cutCurve(p, t) {
  const levels = deCasteljauLevels(p, t);
  const L = levels.map((level) => level[0]);
  const R = levels.map((level) => level[level.length - 1]).reverse();
  return { L, R };
}

// Q: the piece cut again in stage 5 (L or R of the original curve).
function qPoints() {
  return cutCurve(control, CUT_T)[chosenHalf || 'L'];
}

// All named points the student can work with: the P triangle, and the Q
// triangle once a piece has been chosen.
function allNamedPoints() {
  const named = namedPoints(control, CUT_T, 'P');
  if (chosenHalf) Object.assign(named, namedPoints(qPoints(), CUT_T, 'Q'));
  return named;
}

// Sample the curve at n + 1 evenly spaced values of t in [t0, t1].
function sampleCurve(p, t0, t1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(bezierPoint(p, t0 + (t1 - t0) * i / n));
  return pts;
}

// Length of a polyline: the sum of its segment lengths.
function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

// Approximate length of the curve from t0 to t1 (with many short segments).
function arcLength(p, t0, t1) {
  return polylineLength(sampleCurve(p, t0, t1, 400));
}

// The point halfway along the curve by length. Walk along a fine sampling
// until half of the total length is used up.
function halfwayByLength(p) {
  const pts = sampleCurve(p, 0, 1, 800);
  const half = polylineLength(pts) / 2;
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const step = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (walked + step >= half) return lerp(pts[i - 1], pts[i], (half - walked) / step);
    walked += step;
  }
  return pts[pts.length - 1];
}


// -----------------------------------------------------------------------------
// Section 4. Recursive subdivision: stopping rules and the call trace.
// -----------------------------------------------------------------------------

// Distance from point q to the line through a and b: the length of the
// cross product of (b - a) and (q - a), divided by the length of (b - a).
function distanceToLine(q, a, b) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1e-9) return Math.hypot(q.x - a.x, q.y - a.y);  // a and b coincide.
  return Math.abs((b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x)) / len;
}

// How far a piece is from being straight: the larger distance of its two
// inner control points from the chord (the segment from first to last).
function flatness(p) {
  return Math.max(distanceToLine(p[1], p[0], p[3]), distanceToLine(p[2], p[0], p[3]));
}

// Should we stop cutting this piece? Stage 6's rules, in screen pixels.
function shouldStop(p, depth) {
  const value = stopRule.values[stopRule.name];
  if (depth >= MAX_DEPTH) return true;
  if (stopRule.name === 'depth') return depth >= value;
  if (stopRule.name === 'flat') return flatness(p) * fit.scale <= value;
  return polylineLength(p) * fit.scale <= value;  // 'length'
}

// The recursive algorithm itself. Instead of drawing, it collects the
// pieces that would be drawn as line segments ("leaves").
function subdivide(p, depth, leaves) {
  if (shouldStop(p, depth)) {
    leaves.push({ pts: p, depth });
    return;
  }
  const { L, R } = cutCurve(p, CUT_T);
  subdivide(L, depth + 1, leaves);
  subdivide(R, depth + 1, leaves);
}

// The same recursion, recorded as a list of events for stage 7:
//   call    drawBezier is called on a piece (with the flatness test result)
//   line    base case: the piece is drawn as one line segment, and returns
//   return  both halves of a piece are done; its call returns
// Each piece is named by its path of cuts: '' is the whole curve, 'LR' the
// R piece of the L piece.
function buildTrace(p, tolerance) {
  const events = [];
  (function visit(pts, path) {
    const f = flatness(pts);
    const flat = f <= tolerance || path.length >= MAX_DEPTH;
    events.push({ type: 'call', path, pts, flatness: f, flat });
    if (flat) {
      events.push({ type: 'line', path, pts });
      return;
    }
    const { L, R } = cutCurve(pts, CUT_T);
    visit(L, path + 'L');
    visit(R, path + 'R');
    events.push({ type: 'return', path, pts });
  })(p, '');
  return events;
}

// The piece reached by a path of cuts from the whole curve: 'LR' is the R
// piece of the L piece.
function pieceAt(path) {
  let p = control;
  for (const side of path) p = cutCurve(p, CUT_T)[side];
  return p;
}

// The foot of the perpendicular from q to the line through a and b.
function footOnLine(q, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return a;
  const u = ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2;
  return { x: a.x + u * dx, y: a.y + u * dy };
}

// The convex hull of a few points (Andrew's monotone chain): the smallest
// convex polygon containing them, as a list of corners in order.
function convexHull(pts) {
  const sorted = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();  // The last point starts the other half.
    return out;
  };
  return half(sorted).concat(half(sorted.slice().reverse()));
}

function pieceName(path) {
  return path === '' ? 'the whole curve' : path;
}


// -----------------------------------------------------------------------------
// Section 5. Drawing helpers.
// -----------------------------------------------------------------------------
// All helpers take WORLD points and convert them with toScreen, so the
// picture scales with the window while line widths stay the same.

const COLORS = {
  polygon: '#888888',       // Original control polygon.
  curve: '#1f5fbf',         // The Bézier curve.
  pieceA: '#1f5fbf',        // Stage 1: first piece of the cut curve.
  pieceB: '#e08a00',        // Stage 1: second piece.
  construction: '#e08a00',  // Points and segments the student builds.
  L: '#7b3fbf',             // The first piece, L.
  R: '#1f8a4c',             // The second piece, R.
  QL: '#c2185b',            // Stage 5: Q's first piece.
  QR: '#00838f',            // Stage 5: Q's second piece.
  mark: '#c0262d',          // B(t), tick marks, tangent.
  point: '#222222',         // Control points.
  segment: '#222222',       // Line segments that replace the curve.
};

function strokePolyline(pts, color, width, dash) {
  if (pts.length < 2) return;
  ctx.beginPath();
  const s0 = toScreen(pts[0]);
  ctx.moveTo(s0.x, s0.y);
  for (let i = 1; i < pts.length; i++) {
    const s = toScreen(pts[i]);
    ctx.lineTo(s.x, s.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

function fillCircle(p, radius, color) {
  const s = toScreen(p);
  ctx.beginPath();
  ctx.arc(s.x, s.y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeCircle(p, radius, color, width) {
  const s = toScreen(p);
  ctx.beginPath();
  ctx.arc(s.x, s.y, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

// A labeled point: white ring for contrast, filled dot, then the label.
function drawPoint(p, label, color, radius) {
  fillCircle(p, radius + 1.5, '#ffffff');
  fillCircle(p, radius, color);
  if (label) drawLabel(p, label, color);
}

// Text next to a point. Labels go up and to the right unless LABEL_OFFSETS
// gives a better spot (some construction points sit close to the curve).
const LABEL_OFFSETS = {
  P0: [-26, 4], P3: [10, 4],
  P01: [-34, 4], P012: [-40, 18], P0123: [-18, 26], P123: [8, 22],
  Q0123: [-18, 26], Q012: [-40, 18], Q123: [8, 22],
};

function drawLabel(p, text, color) {
  const s = toScreen(p);
  const [dx, dy] = LABEL_OFFSETS[text] || [9, -7];
  ctx.font = '14px system-ui, sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';               // A white outline keeps text
  ctx.strokeText(text, s.x + dx, s.y + dy);  // readable over lines.
  ctx.fillStyle = color;
  ctx.fillText(text, s.x + dx, s.y + dy);
}

// A hollow diamond (marks the point halfway along the curve by length).
function strokeDiamond(p, r, color) {
  const s = toScreen(p);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - r);
  ctx.lineTo(s.x + r, s.y);
  ctx.lineTo(s.x, s.y + r);
  ctx.lineTo(s.x - r, s.y);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// A small × (marks a click that missed).
function drawCross(p, color) {
  const s = toScreen(p), r = 5;
  ctx.beginPath();
  ctx.moveTo(s.x - r, s.y - r); ctx.lineTo(s.x + r, s.y + r);
  ctx.moveTo(s.x + r, s.y - r); ctx.lineTo(s.x - r, s.y + r);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// A light background grid, every 50 world units, covering the whole canvas.
function drawGrid() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const topLeft = toWorld({ x: 0, y: 0 }), bottomRight = toWorld({ x: w, y: h });
  ctx.strokeStyle = '#ececec';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.ceil(topLeft.x / 50) * 50; x <= bottomRight.x; x += 50) {
    const sx = Math.round(toScreen({ x, y: 0 }).x) + 0.5;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
  }
  for (let y = Math.ceil(topLeft.y / 50) * 50; y <= bottomRight.y; y += 50) {
    const sy = Math.round(toScreen({ x: 0, y }).y) + 0.5;
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
  }
  ctx.stroke();
}

// Label the length of a piece of the curve, placed beside the middle of the
// piece on the side away from the control polygon.
function labelLength(p, t0, t1, color) {
  const mid = bezierPoint(p, (t0 + t1) / 2);
  const ahead = bezierPoint(p, Math.min(1, (t0 + t1) / 2 + 0.01));
  // A unit vector perpendicular to the curve at mid.
  let nx = -(ahead.y - mid.y), ny = ahead.x - mid.x;
  const len = Math.hypot(nx, ny) || 1;
  nx /= len; ny /= len;
  // Flip it if it points toward the center of the control points.
  const cx = p.reduce((s, q) => s + q.x, 0) / p.length;
  const cy = p.reduce((s, q) => s + q.y, 0) / p.length;
  if (nx * (cx - mid.x) + ny * (cy - mid.y) > 0) { nx = -nx; ny = -ny; }

  const s = toScreen(mid);
  const text = 'length ≈ ' + Math.round(arcLength(p, t0, t1));
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, s.x + nx * 34, s.y + ny * 34);
  ctx.fillStyle = color;
  ctx.fillText(text, s.x + nx * 34, s.y + ny * 34);
  ctx.textAlign = 'start';
}

// A Bézier piece: its curve (solid) and its control polygon (dashed).
function drawPiece(p, color, width) {
  strokePolyline(p, color, 1.5, [6, 5]);
  strokePolyline(sampleCurve(p, 0, 1, CURVE_SEGMENTS), color, width, []);
}


// -----------------------------------------------------------------------------
// Section 6. Draw one frame.
// -----------------------------------------------------------------------------
// VIEW FLAGS: each step's "view" (plus extraView) says what to draw.
//   splitAtT      color the two pieces of the curve cut at t; mark B(t)
//   lengths       label the length of each piece
//   tTicks        tick marks at t = 0, 0.1, ..., 1
//   halfLength    the point halfway along the curve by length
//   draggable     the control points can be dragged
//   construction  the points and segments the student built
//   markCut       ring around P0123 (it is on the curve)
//   tangentAtCut  the line through P012 and P123
//   showL         L's control polygon (while picking R)
//   LR            the two pieces L and R, drawn over the original curve
//   half          stage 5: L and R, with Q (the chosen one) highlighted
//   halfCut       stage 5: the other piece, QL, and QR
//   stopRule      stage 6: the line segments the current stopping rule gives
//   flatness      stage 6: one piece judged against its chord (zoomed in)
//   trace         stage 7: the recursion, as far as it has been stepped

const CURVE_SEGMENTS = 100;
const TANGENT_HALF_LENGTH = 2000;

function currentView() {
  return Object.assign({}, STEPS[stepIndex].view || {}, extraView);
}

// The original curve, wide and light, as a background for its pieces.
function drawGhostCurve() {
  strokePolyline(sampleCurve(control, 0, 1, CURVE_SEGMENTS), '#d4d4d4', 10, []);
}

function draw() {
  const v = currentView();
  const named = allNamedPoints();
  const prefix = v.half ? 'Q' : 'P';  // Which triangle is being built.
  const step = STEPS[stepIndex];
  // Zoom in on the piece being worked on (stage 5's Q, or the piece being
  // judged in the flatness view); otherwise show the whole world box.
  if (v.half) updateFit(paddedBox(qPoints(), 0.15));
  else if (v.flatness) updateFit(paddedBox(pieceAt(flatPath), 0.3));
  else updateFit({ x: 0, y: 0, w: WORLD_WIDTH, h: WORLD_HEIGHT });

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  drawGrid();

  // 1. The original control polygon, dashed (lighter once we work on pieces).
  const onPieces = v.half || v.halfCut || v.flatness || v.stopRule || v.trace;
  strokePolyline(control, onPieces ? '#cccccc' : COLORS.polygon, 1.5, [6, 5]);

  // 2. The curve, or its pieces.
  if (v.LR) {
    const { L, R } = cutCurve(control, CUT_T);
    drawGhostCurve();
    drawPiece(L, COLORS.L, 3);
    drawPiece(R, COLORS.R, 3);
  } else if (v.half) {
    // The piece being cut (Q) in its color; the other piece faded.
    const { L, R } = cutCurve(control, CUT_T);
    drawGhostCurve();
    strokePolyline(sampleCurve(chosenHalf === 'L' ? R : L, 0, 1, CURVE_SEGMENTS),
      COLORS[chosenHalf === 'L' ? 'R' : 'L'], 2, []);
    drawPiece(qPoints(), COLORS[chosenHalf], 3);
  } else if (v.halfCut) {
    const { L, R } = cutCurve(control, CUT_T);
    const q = cutCurve(qPoints(), CUT_T);
    drawGhostCurve();
    drawPiece(chosenHalf === 'L' ? R : L, COLORS[chosenHalf === 'L' ? 'R' : 'L'], 3);
    drawPiece(q.L, COLORS.QL, 3);
    drawPiece(q.R, COLORS.QR, 3);
  } else if (v.splitAtT) {
    strokePolyline(sampleCurve(control, 0, t, CURVE_SEGMENTS), COLORS.pieceA, 3.5, []);
    strokePolyline(sampleCurve(control, t, 1, CURVE_SEGMENTS), COLORS.pieceB, 3.5, []);
  } else if (v.flatness) {
    drawGhostCurve();
    drawFlatness();
  } else if (v.stopRule) {
    drawGhostCurve();
    drawStopRule();
  } else if (v.trace) {
    drawGhostCurve();
    drawTrace();
  } else {
    strokePolyline(sampleCurve(control, 0, 1, CURVE_SEGMENTS), COLORS.curve, 3, []);
  }

  // 3. Stage 1 extras: tick marks, lengths, the halfway point, B(t).
  if (v.tTicks) {
    for (let i = 0; i <= 10; i++) fillCircle(bezierPoint(control, i / 10), 3.5, COLORS.mark);
  }
  if (v.lengths) {
    labelLength(control, 0, t, COLORS.pieceA);
    labelLength(control, t, 1, COLORS.pieceB);
  }
  if (v.halfLength) {
    const h = halfwayByLength(control);
    strokeDiamond(h, 8, COLORS.mark);
    drawLabel(h, 'halfway by length', COLORS.mark);
  }
  if (v.splitAtT) {
    const b = bezierPoint(control, t);
    drawPoint(b, null, COLORS.mark, 6);
    drawLabel(b, t === 0.5 ? 'B(½)' : 'B(' + t.toFixed(2) + ')', COLORS.mark);
  }

  // 4. What the student built: segments, then points. Only the triangle
  //    being worked on (prefix P or Q) is shown.
  if (v.construction) {
    for (const [a, b] of segments) {
      if (a[0] === prefix) strokePolyline([named[a], named[b]], COLORS.construction, 2, []);
    }
    if (v.tangentAtCut) {
      const a = named.P012, b = named.P123;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
      const m = named.P0123;
      strokePolyline([
        { x: m.x - ux * TANGENT_HALF_LENGTH, y: m.y - uy * TANGENT_HALF_LENGTH },
        { x: m.x + ux * TANGENT_HALF_LENGTH, y: m.y + uy * TANGENT_HALF_LENGTH },
      ], COLORS.mark, 1.5, [2, 4]);
    }
    if (v.showL && picks.L) {
      strokePolyline(picks.L.map((n) => named[n]), COLORS.L, 3, []);
    }
    if (picks.QL && step.name === 'QR') {
      strokePolyline(picks.QL.map((n) => named[n]), COLORS.QL, 3, []);
    }
    // The control points of the piece being picked, in order so far.
    if (step.type === 'pick' && pending.length > 0) {
      strokePolyline(pending.map((n) => named[n]), COLORS[step.name], 3, []);
    }
    for (const name of placed) {
      if (name[0] === prefix) drawPoint(named[name], name, COLORS.construction, 4.5);
    }
    if (v.markCut && placed.has('P0123')) {
      strokeCircle(named.P0123, 11, COLORS.mark, 2);
    }
    // The first point of a connection in progress.
    if (step.type === 'connect' && pending.length === 1) {
      strokeCircle(named[pending[0]], 10, COLORS.construction, 2.5);
    }
  }

  if (missedAt) drawCross(missedAt, '#999999');

  // 5. Control points, on top: P0..P3, or Q0..Q3 while working on Q. The
  //    flatness view draws its own piece's control points instead.
  if (v.flatness) {
    // Nothing more to draw.
  } else if (v.half) {
    control.forEach((p) => fillCircle(p, 3.5, '#bbbbbb'));
    qPoints().forEach((p, i) => drawPoint(p, 'Q' + i, COLORS[chosenHalf], 5.5));
  } else {
    control.forEach((p, i) => drawPoint(p, 'P' + i, onPieces ? '#999999' : COLORS.point, onPieces ? 4 : 5.5));
  }
  if (v.LR) {
    // Label the construction points that L and R use.
    const { L, R } = cutCurve(control, CUT_T);
    ['P01', 'P012'].forEach((n, i) => drawPoint(L[i + 1], n, COLORS.L, 4.5));
    ['P123', 'P23'].forEach((n, i) => drawPoint(R[i + 1], n, COLORS.R, 4.5));
    drawPoint(L[3], 'P0123', COLORS.mark, 5);
  }
}

// Fill a polygon given by world points.
function fillPolygon(pts, color) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const s = toScreen(p);
    if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// Stage 6: judge one piece against its chord. Draws, from back to front:
// the convex hull of its control points (shaded), the tolerance band around
// the chord (green), the piece and its control polygon, the chord (dashed),
// and the perpendicular distances d1 and d2 from the inner control points.
function drawFlatness() {
  const p = pieceAt(flatPath);
  const a = p[0], b = p[3];

  fillPolygon(convexHull(p), 'rgba(31, 95, 191, 0.08)');

  // The band: every point within flatTol of the chord, between its ends.
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len > 1e-9) {
    const nx = -(b.y - a.y) / len * flatTol, ny = (b.x - a.x) / len * flatTol;
    fillPolygon([
      { x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny },
      { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny },
    ], 'rgba(46, 139, 87, 0.22)');
  }

  drawPiece(p, COLORS.L, 3.5);
  strokePolyline([a, b], COLORS.segment, 2, [8, 5]);

  [p[1], p[2]].forEach((q, i) => {
    const d = distanceToLine(q, a, b);
    const color = d <= flatTol ? '#2e8b57' : COLORS.mark;
    const foot = footOnLine(q, a, b);
    strokePolyline([q, foot], color, 2, []);
    drawLabel(lerp(q, foot, 0.5), `d${i + 1} = ${d.toFixed(1)}`, color);
    drawPoint(q, null, COLORS.L, 5);
  });
  drawPoint(a, null, COLORS.segment, 5.5);
  drawPoint(b, null, COLORS.segment, 5.5);
}

// Stage 6: run the recursion with the current stopping rule and draw the
// line segments it would draw. Optionally show each piece's control
// polygon, in alternating colors.
function drawStopRule() {
  const leaves = [];
  subdivide(control, 0, leaves);
  if ($('show-polygons') && $('show-polygons').checked) {
    leaves.forEach((leaf, i) => strokePolyline(leaf.pts, i % 2 ? COLORS.R : COLORS.L, 1.2, [4, 4]));
  }
  for (const leaf of leaves) {
    strokePolyline([leaf.pts[0], leaf.pts[3]], COLORS.segment, 2, []);
  }
  for (const leaf of leaves) fillCircle(leaf.pts[0], 3, COLORS.segment);
  fillCircle(control[3], 3, COLORS.segment);
}

// Stage 7: the segments drawn so far, the pieces whose calls are still
// waiting (faint), and the current piece (bold, with its control polygon).
function drawTrace() {
  if (!trace) return;
  for (const frame of trace.stack) {
    strokePolyline(frame.pts, '#c9b8e6', 1.2, [4, 4]);
  }
  for (const pts of trace.lines) {
    strokePolyline([pts[0], pts[3]], COLORS.segment, 2.5, []);
    fillCircle(pts[0], 3, COLORS.segment);
    fillCircle(pts[3], 3, COLORS.segment);
  }
  const top = trace.stack[trace.stack.length - 1];
  if (top) {
    drawPiece(top.pts, COLORS.L, 4);
    const m = bezierPoint(top.pts, 0.5);
    drawLabel(m, pieceName(top.path), COLORS.L);
  }
}


// -----------------------------------------------------------------------------
// Section 7. The steps: show the current step and check answers.
// -----------------------------------------------------------------------------
// renderStep() builds the panel for STEPS[stepIndex]. Each step type has a
// render function that fills in the step's body. A step's task must be done
// (stepDone = true) before the Next button works.

const $ = (id) => document.getElementById(id);
const titleEl = $('step-title');
const bodyEl = $('step-body');
const nextButton = $('next');

// Build an element from an HTML string.
function html(str) {
  const div = document.createElement('div');
  div.innerHTML = str;
  return div;
}

// Show feedback below the step: kind is 'good', 'bad', or '' (neutral).
function setFeedback(content, kind) {
  let box = bodyEl.querySelector('.feedback');
  if (!box) {
    box = document.createElement('div');
    bodyEl.appendChild(box);
  }
  box.className = 'feedback ' + (kind || '');
  box.innerHTML = content;
}

function finishStep() {
  stepDone = true;
  nextButton.disabled = false;
}

function addReview(text) {
  review.push({ title: STEPS[stepIndex].title, text });
}

let wasWide = false;  // Was the panel wide for the previous step?

function renderStep() {
  const step = STEPS[stepIndex];
  stepDone = false;
  extraView = {};
  pending = [];
  misses = 0;
  missedAt = null;
  dragIndex = -1;
  control = copyPoints(CONTROL_POINTS);  // Undo any dragging from an earlier step.
  // Steps after the trace show its finished result: all the segments.
  trace = null;
  if ((step.view || {}).trace && step.type !== 'trace') {
    const traceStep = STEPS.find((s) => s.type === 'trace');
    const events = buildTrace(control, traceStep.tolerance);
    trace = { events, next: events.length, stack: [],
      lines: events.filter((e) => e.type === 'line').map((e) => e.pts) };
  }

  // Stage 8 shows long lines of pseudocode, so the panel gets wider. The
  // canvas changes size with it, so it must be resized.
  if (document.body.classList.toggle('wide', step.stage === 8) !== wasWide) resizeCanvas();
  wasWide = step.stage === 8;

  titleEl.textContent = step.title;
  bodyEl.innerHTML = '';
  if (step.text) bodyEl.appendChild(html(step.text));
  RENDER[step.type](step);

  nextButton.disabled = !stepDone;
  nextButton.style.display = step.type === 'end' ? 'none' : '';
  $('progress-bar').style.width = (100 * stepIndex / (STEPS.length - 1)) + '%';
  const clickable = ['place', 'connect', 'pick', 'trace'].includes(step.type) || (step.view || {}).draggable;
  canvas.style.cursor = clickable ? 'crosshair' : 'default';
  renderStageNav();
  renderTriangle();
  draw();
}

const RENDER = {

  info() {
    finishStep();
  },

  // Stage 1: a slider for t. Any t is allowed; the step is done at t = 1/2.
  'choose-t'(step) {
    bodyEl.appendChild(html(`
      <div class="row">
        <label for="t-slider">t = <strong id="t-value"></strong></label>
        <input id="t-slider" type="range" min="0.05" max="0.95" step="0.05">
        <button id="cut">Cut here</button>
      </div>`));
    const slider = $('t-slider');
    slider.value = t;
    $('t-value').textContent = t.toFixed(2);
    slider.addEventListener('input', () => {
      t = Number(slider.value);
      $('t-value').textContent = t.toFixed(2);
      draw();
    });
    $('cut').addEventListener('click', () => {
      if (Math.abs(t - CUT_T) < 1e-9) {
        t = CUT_T;
        setFeedback(step.isHalf, 'good');
        finishStep();
      } else {
        setFeedback(step.notHalf.replaceAll('{t}', t.toFixed(2)), '');
      }
      draw();
    });
  },

  // Multiple choice. Every choice explains itself when picked. The student
  // keeps trying until they find the right one.
  mc(step) {
    bodyEl.appendChild(html(`<p class="question">${step.question}</p>`));
    const options = step.options.slice();
    // Shuffle (Fisher–Yates), so the right answer is not always in one spot.
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    let wrongYet = false;
    for (const option of options) {
      const button = document.createElement('button');
      button.className = 'choice';
      button.textContent = option.text;
      const why = document.createElement('div');
      why.className = 'why';
      bodyEl.appendChild(button);
      bodyEl.appendChild(why);
      button.addEventListener('click', () => {
        if (stepDone) return;
        why.textContent = option.why;
        button.classList.add(option.correct ? 'right' : 'wrong');
        if (option.correct) {
          Object.assign(extraView, step.viewAfter || {});
          finishStep();
          draw();
        } else if (!wrongYet) {
          wrongYet = true;
          addReview(step.question);
        }
      });
    }
  },

  // Click on the canvas to place construction points (see Section 8).
  place(step) {
    bodyEl.appendChild(html(`<p id="status"></p>
      <div class="row"><button id="show-one" style="display:none">Show me one</button></div>`));
    $('show-one').addEventListener('click', () => {
      const next = step.targets.find((n) => !placed.has(n) && parentsPlaced(step, n));
      if (next) placePoint(step, next);
    });
    updatePlaceStatus(step);
  },

  // Click two points to draw a segment between them (see Section 8).
  connect(step) {
    bodyEl.appendChild(html('<p id="status"></p>'));
    updateConnectStatus(step);
  },

  // Click the control points of a piece in order (see Section 8).
  pick(step) {
    if (picks[step.name]) pending = picks[step.name].slice();  // Already done.
    bodyEl.appendChild(html(`<p id="status"></p>
      <div class="row"><button id="undo">Undo last</button></div>`));
    $('undo').addEventListener('click', () => {
      if (stepDone) return;
      pending.pop();
      updatePickStatus(step);
      renderTriangle();
      draw();
    });
    updatePickStatus(step);
    if (picks[step.name]) finishStep();
  },

  // Stage 5: choose L or R as the piece Q to cut again.
  'choose-half'() {
    bodyEl.appendChild(html(`<div class="row">
      <button id="pick-L" style="color:${COLORS.L}">Cut L</button>
      <button id="pick-R" style="color:${COLORS.R}">Cut R</button></div>`));
    for (const half of ['L', 'R']) {
      $('pick-' + half).addEventListener('click', () => {
        // Choosing again starts the Q construction over.
        chosenHalf = half;
        placed = new Set([...placed].filter((n) => n[0] !== 'Q'));
        segments = segments.filter((s) => s[0][0] !== 'Q');
        delete picks.QL;
        delete picks.QR;
        setFeedback(`<p>Q is ${half}. Click Next to cut it.</p>`, 'good');
        finishStep();
        draw();
      });
    }
    if (chosenHalf) finishStep();
  },

  // Stage 6: judge one piece against its chord. Buttons move through the
  // tree of pieces; a slider sets the tolerance.
  flatness(step) {
    flatPath = '';
    if (flatTol === null) flatTol = step.tolerance;
    bodyEl.appendChild(html(`
      <p id="piece-name" class="question"></p>
      <div class="row">
        <button id="look-L">Cut it: look at L</button>
        <button id="look-R">Look at R</button>
        <button id="back-up">Back up</button>
      </div>
      <div class="row">
        <label for="tol-slider" id="tol-label"></label>
        <input id="tol-slider" type="range" min="1" max="30" step="1">
      </div>
      <div id="flat-verdict" class="feedback"></div>`));
    const slider = $('tol-slider');
    slider.value = flatTol;
    function update() {
      const p = pieceAt(flatPath);
      const d1 = distanceToLine(p[1], p[0], p[3]), d2 = distanceToLine(p[2], p[0], p[3]);
      const f = Math.max(d1, d2);
      const flat = f <= flatTol;
      $('piece-name').textContent = flatPath === ''
        ? 'Piece: the whole curve (level 0)'
        : `Piece: ${flatPath} (level ${flatPath.length})`;
      $('tol-label').textContent = `Tolerance: ${flatTol} units`;
      $('flat-verdict').className = 'feedback ' + (flat ? 'good' : 'bad');
      $('flat-verdict').innerHTML =
        `<p>d1 = ${d1.toFixed(1)}, d2 = ${d2.toFixed(1)}, so flatness = max(d1, d2) = ${f.toFixed(1)}.</p>` +
        (flat
          ? `<p>${f.toFixed(1)} ≤ ${flatTol}: <strong>flat enough.</strong> Draw the chord and stop.</p>`
          : `<p>${f.toFixed(1)} &gt; ${flatTol}: <strong>not flat enough.</strong> Cut it in two.</p>`);
      $('back-up').disabled = flatPath === '';
      $('look-L').textContent = flat ? 'Look at L anyway' : 'Cut it: look at L';
      $('look-L').disabled = $('look-R').disabled = flatPath.length >= 8;
      draw();
    }
    $('look-L').addEventListener('click', () => { flatPath += 'L'; update(); });
    $('look-R').addEventListener('click', () => { flatPath += 'R'; update(); });
    $('back-up').addEventListener('click', () => { flatPath = flatPath.slice(0, -1); update(); });
    slider.addEventListener('input', () => { flatTol = Number(slider.value); update(); });
    update();
    finishStep();
  },

  // Stage 6: radio buttons for the three rules, a slider for the chosen
  // rule's setting, and a readout of how many segments it gives.
  'explore-stop'(step) {
    for (const [name, rule] of Object.entries(step.rules)) {
      if (stopRule.values[name] === undefined) stopRule.values[name] = rule.value;
    }
    const radios = Object.entries(step.rules).map(([name, rule]) =>
      `<label class="block"><input type="radio" name="rule" value="${name}"> ${rule.label}</label>`).join('');
    bodyEl.appendChild(html(`
      ${radios}
      <p id="rule-text"></p>
      <div class="row">
        <label for="rule-slider" id="rule-label"></label>
        <input id="rule-slider" type="range">
      </div>
      <p id="stop-readout" class="question"></p>
      <label class="block"><input id="show-polygons" type="checkbox"> Show each piece's control polygon</label>`));
    const slider = $('rule-slider');
    function showRule() {
      const rule = step.rules[stopRule.name];
      $('rule-text').textContent = rule.text;
      slider.min = rule.min;
      slider.max = rule.max;
      slider.step = rule.step;
      slider.value = stopRule.values[stopRule.name];
      updateStopReadout();
      draw();
    }
    bodyEl.querySelectorAll('input[name="rule"]').forEach((radio) => {
      radio.checked = radio.value === stopRule.name;
      radio.addEventListener('change', () => { stopRule.name = radio.value; showRule(); });
    });
    slider.addEventListener('input', () => {
      stopRule.values[stopRule.name] = Number(slider.value);
      updateStopReadout();
      draw();
    });
    $('show-polygons').addEventListener('change', draw);
    showRule();
    finishStep();
  },

  // Stage 7: step through the recursion one event at a time.
  trace(step) {
    trace = {
      events: buildTrace(control, step.tolerance),
      next: 0,             // Index of the next event to run.
      stack: [],           // Calls that have started but not returned.
      lines: [],           // Pieces drawn as line segments so far.
      predictionsLeft: step.predictions,
      tolerance: step.tolerance,
    };
    bodyEl.appendChild(html(`
      <div class="row"><button id="step">Step</button><button id="run">Run to the end</button></div>
      <p id="event-text"></p>
      <h3>Call stack (most recent call at the bottom)</h3>
      <pre id="stack" class="box code"></pre>`));
    $('step').addEventListener('click', () => stepTrace(step));
    $('run').addEventListener('click', () => {
      // Run the rest without predictions.
      trace.predictionsLeft = 0;
      trace.awaitingPrediction = false;
      missedAt = null;
      while (trace.next < trace.events.length) applyEvent(trace.events[trace.next++]);
      updateTracePanel(step);
      draw();
    });
    updateTracePanel(step);
  },

  // Stage 8: put shuffled lines in order with up/down buttons.
  parsons(step) {
    let order = step.lines.map((line, i) => i);
    // Shuffle until the order is wrong somewhere.
    do {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    } while (parsonsCorrect(step, order).every(Boolean));
    if (picks.parsons) order = picks.parsons.slice();  // Already done.

    bodyEl.appendChild(html(`<ol id="parsons" class="parsons"></ol>
      <div class="row"><button id="check-order">Check the order</button></div>`));
    let checked = null;  // Result of the last check, shown until a line moves.
    function renderList() {
      const list = $('parsons');
      list.innerHTML = '';
      order.forEach((lineIndex, pos) => {
        const li = document.createElement('li');
        if (checked) li.className = checked[pos] ? 'right' : 'wrong';
        const up = document.createElement('button');
        up.textContent = '↑';
        up.disabled = pos === 0 || stepDone;
        up.setAttribute('aria-label', 'Move line up');
        const down = document.createElement('button');
        down.textContent = '↓';
        down.disabled = pos === order.length - 1 || stepDone;
        down.setAttribute('aria-label', 'Move line down');
        const code = document.createElement('code');
        code.textContent = step.lines[lineIndex].text;
        li.append(up, down, code);
        up.addEventListener('click', () => { swap(pos, pos - 1); });
        down.addEventListener('click', () => { swap(pos, pos + 1); });
        list.appendChild(li);
      });
    }
    function swap(a, b) {
      [order[a], order[b]] = [order[b], order[a]];
      checked = null;
      renderList();
    }
    let wrongYet = false;
    $('check-order').addEventListener('click', () => {
      checked = parsonsCorrect(step, order);
      const wrong = checked.filter((ok) => !ok).length;
      if (wrong === 0) {
        picks.parsons = order.slice();
        setFeedback(`<p>Correct order. ${step.done}</p>`, 'good');
        $('check-order').style.display = 'none';
        finishStep();
      } else {
        if (!wrongYet) { wrongYet = true; addReview('Putting the lines of drawBezier in order'); }
        setFeedback(`<p>${wrong} line${wrong > 1 ? 's are' : ' is'} in the wrong place (marked ✗). Hint: the base case comes first, then the midpoints level by level, then the recursive calls.</p>`, 'bad');
      }
      renderList();
    });
    renderList();
    if (picks.parsons) { setFeedback(`<p>Correct order. ${step.done}</p>`, 'good'); finishStep(); }
  },

  // The summary and the review list. The list is also saved in this
  // browser (localStorage) so the student can come back to it.
  end() {
    const part = html('<h3>Your review list</h3>');
    if (review.length === 0) {
      part.appendChild(html('<p>Nothing to review: no missed ideas or questions.</p>'));
    } else {
      const list = document.createElement('ul');
      for (const item of review) {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${item.title}:</strong> `;
        li.appendChild(document.createTextNode(item.text));
        list.appendChild(li);
      }
      part.appendChild(list);
    }
    part.appendChild(html('<div class="row"><button id="restart">Start over</button></div>'));
    bodyEl.appendChild(part);
    $('restart').addEventListener('click', () => goToStep(0));
    try {
      localStorage.setItem(REVIEW_KEY, JSON.stringify(review));
    } catch (e) {
      // Storage can be unavailable (private windows, blocked site data).
    }
  },
};

nextButton.addEventListener('click', () => {
  if (!stepDone || stepIndex >= STEPS.length - 1) return;
  stepIndex++;
  renderStep();
});

// Parsons check: is each position's line from the right group?
function parsonsCorrect(step, order) {
  return order.map((lineIndex, pos) => step.lines[lineIndex].group === step.lines[pos].group);
}

// --- Stage 6: the readout for the current stopping rule. ---

function updateStopReadout() {
  const step = STEPS[stepIndex];
  const rule = step.rules[stopRule.name];
  const value = stopRule.values[stopRule.name];
  $('rule-label').textContent = `${rule.setting}: ${value}${rule.unit}`;
  const leaves = [];
  subdivide(control, 0, leaves);
  const deepest = Math.max(...leaves.map((l) => l.depth));
  const shallowest = Math.min(...leaves.map((l) => l.depth));
  $('stop-readout').textContent = `${leaves.length} line segment${leaves.length > 1 ? 's' : ''}` +
    (deepest === shallowest ? `, all at level ${deepest}` : `, levels ${shallowest} to ${deepest}`) + '.';
}

// --- Stage 7: running the trace. ---

// Run the next event, unless the student must first predict it.
function stepTrace(step) {
  if (trace.next >= trace.events.length) return;
  const event = trace.events[trace.next];
  if (event.type === 'line' && trace.predictionsLeft > 0 && !trace.awaitingPrediction) {
    trace.awaitingPrediction = true;
    updateTracePanel(step);
    return;
  }
  if (trace.awaitingPrediction) return;  // Wait for the click on the canvas.
  const box = bodyEl.querySelector('.feedback');
  if (box) box.remove();  // Clear the last prediction's feedback.
  trace.next++;
  applyEvent(event);
  updateTracePanel(step);
  draw();
}

function applyEvent(event) {
  if (event.type === 'call') {
    trace.stack.push(event);
  } else if (event.type === 'line') {
    trace.lines.push(event.pts);
    trace.stack.pop();
  } else {
    trace.stack.pop();
  }
}

// The text for an event, shown after it runs.
function eventText(event) {
  const name = pieceName(event.path);
  if (event.type === 'call') {
    const test = `flatness ${event.flatness.toFixed(1)} ${event.flat ? '≤' : '>'} tolerance ${trace.tolerance}`;
    return event.flat
      ? `Called drawBezier on ${name}: ${test}, so it is flat enough. Base case next.`
      : `Called drawBezier on ${name}: ${test}, so cut it into ${event.path}L and ${event.path}R, and call drawBezier on ${event.path}L first.`;
  }
  if (event.type === 'line') {
    return `Base case: draw ${name} as one line segment, from its first control point to its last. Return.`;
  }
  return `Both halves of ${name} are done. Return to the caller.`;
}

function updateTracePanel(step) {
  const done = trace.next >= trace.events.length;
  const last = trace.events[trace.next - 1];
  let text;
  if (trace.awaitingPrediction) {
    text = '<strong>Predict:</strong> the next event draws a line segment. Click on the canvas where you think it will be.';
  } else if (done) {
    text = `Done: the curve is drawn with ${trace.lines.length} line segments. ` +
      'The Bézier playground uses 100 segments, evenly spaced in t. Here the segments are short where the curve bends sharply, and long where it is nearly straight.';
  } else {
    text = last ? eventText(last) : 'Click Step to make the first call: drawBezier on the whole curve.';
  }
  $('event-text').innerHTML = text;
  $('stack').textContent = trace.stack.length
    ? trace.stack.map((f, d) => '  '.repeat(d) + `drawBezier(${f.path || 'whole curve'})`).join('\n')
    : '(empty)';
  $('step').disabled = done || trace.awaitingPrediction;
  $('run').disabled = done;
  if (done) {
    setFeedback(`<p>${trace.lines.length} segments from ${trace.events.filter((e) => e.type === 'call').length} calls. Click Next.</p>`, 'good');
    finishStep();
  }
}


// -----------------------------------------------------------------------------
// Section 8. Canvas input: placing, connecting, picking, predicting.
// -----------------------------------------------------------------------------
// We use "pointer" events, which work for a mouse, a pen, and touch. What a
// click does depends on the current step's type.

const SNAP_RADIUS = 14;  // How close (CSS pixels) a click must be to a point.

// Screen distance between a click and a world point.
function screenDistance(s, p) {
  const q = toScreen(p);
  return Math.hypot(q.x - s.x, q.y - s.y);
}

// Screen distance between a click and the segment from world point a to b.
function screenDistanceToSegment(s, a, b) {
  const p = toScreen(a), q = toScreen(b);
  const dx = q.x - p.x, dy = q.y - p.y;
  const len2 = dx * dx + dy * dy;
  const u = len2 > 0 ? Math.max(0, Math.min(1, ((s.x - p.x) * dx + (s.y - p.y) * dy) / len2)) : 0;
  return Math.hypot(p.x + u * dx - s.x, p.y + u * dy - s.y);
}

// The visible point under the click, or null: the control points of the
// curve being worked on (P or Q) and the placed points of its triangle.
function pointAt(s) {
  const named = allNamedPoints();
  const prefix = currentView().half ? 'Q' : 'P';
  const names = [0, 1, 2, 3].map((i) => prefix + i)
    .concat([...placed].filter((n) => n[0] === prefix));
  let best = null, bestDist = SNAP_RADIUS;
  for (const n of names) {
    const d = screenDistance(s, named[n]);
    if (d <= bestDist) { best = n; bestDist = d; }
  }
  return best;
}

canvas.addEventListener('pointerdown', (event) => {
  const rect = canvas.getBoundingClientRect();
  const s = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const step = STEPS[stepIndex];

  if (currentView().draggable) {
    const i = control.findIndex((p) => screenDistance(s, p) <= SNAP_RADIUS);
    if (i >= 0) {
      dragIndex = i;
      canvas.setPointerCapture(event.pointerId);
    }
    return;
  }
  if (step.type === 'trace') { clickPredict(step, s); return; }
  if (stepDone) return;
  if (step.type === 'place') clickPlace(step, s);
  else if (step.type === 'connect') clickConnect(step, s);
  else if (step.type === 'pick') clickPick(step, s);
});

canvas.addEventListener('pointermove', (event) => {
  if (dragIndex < 0) return;
  const rect = canvas.getBoundingClientRect();
  const w = toWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  // Keep the point inside the world box.
  control[dragIndex] = {
    x: Math.min(Math.max(w.x, 0), WORLD_WIDTH),
    y: Math.min(Math.max(w.y, 0), WORLD_HEIGHT),
  };
  draw();
});

function endDrag() { dragIndex = -1; }
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// --- place: a click close to an unplaced target places it. ---

// With step.ordered, a point can only be placed once the two points it
// comes from (in the level above) are there. Control points always are.
function parentsPlaced(step, name) {
  if (!step.ordered) return true;
  const { k, i } = pointLevel(name);
  if (k <= 1) return true;
  return placed.has(pointName(name[0], k - 1, i)) && placed.has(pointName(name[0], k - 1, i + 1));
}

function clickPlace(step, s) {
  const named = allNamedPoints();
  const near = step.targets.find((n) => !placed.has(n) && screenDistance(s, named[n]) <= SNAP_RADIUS);
  if (near && parentsPlaced(step, near)) {
    placePoint(step, near);
    return;
  }
  misses++;
  missedAt = toWorld(s);
  let message = near
    ? '<p>There is a construction point here, but first place the two points it comes from.</p>'
    : '<p>Not quite: that is not one of the midpoints you are looking for.</p>';
  if (misses >= 2) message += `<p><strong>Hint:</strong> ${step.hint}</p>`;
  setFeedback(message, 'bad');
  if (misses >= 3) $('show-one').style.display = '';
  draw();
}

function placePoint(step, name) {
  placed.add(name);
  missedAt = null;
  if (step.autoConnect) autoConnect(name[0]);
  setFeedback(`<p>Placed ${name}.</p>`, 'good');
  updatePlaceStatus(step);
  renderTriangle();
  draw();
}

// Draw the segment between every pair of neighboring placed points in the
// construction levels (level 0 is the control polygon, already drawn).
function autoConnect(prefix) {
  for (let k = 1; k <= 2; k++) {
    for (let i = 0; i + 1 <= 3 - k; i++) {
      const a = pointName(prefix, k, i), b = pointName(prefix, k, i + 1);
      if (placed.has(a) && placed.has(b) && !segments.some((s) => sameSegment(s, [a, b]))) {
        segments.push([a, b]);
      }
    }
  }
}

function updatePlaceStatus(step) {
  const done = step.targets.filter((n) => placed.has(n)).length;
  $('status').textContent = `Placed ${done} of ${step.targets.length}.`;
  if (done === step.targets.length) {
    $('show-one').style.display = 'none';
    setFeedback('<p>All placed. Click Next.</p>', 'good');
    finishStep();
  }
}

// --- connect: click a point, then another. ---

function sameSegment(a, b) {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

function clickConnect(step, s) {
  const hit = pointAt(s);
  if (!hit) return;
  if (pending.length === 0) {
    pending = [hit];
    setFeedback(`<p>Now click the point to connect to ${hit}.</p>`, '');
    draw();
    return;
  }
  const pair = [pending[0], hit];
  pending = [];
  if (pair[0] === pair[1]) {
    setFeedback('<p>Click two different points.</p>', '');
  } else if (segments.some((seg) => sameSegment(seg, pair))) {
    setFeedback('<p>That segment is already drawn.</p>', '');
  } else if (step.segments.some((seg) => sameSegment(seg, pair))) {
    segments.push(pair);
    setFeedback(`<p>Drew ${pair[0]}–${pair[1]}.</p>`, 'good');
  } else {
    // Explain the wrong pair. The points to connect are the newest level.
    const newest = [...new Set(step.segments.flat())];
    if (!newest.includes(pair[0]) || !newest.includes(pair[1])) {
      setFeedback(`<p>Connect only the newest points: ${newest.join(', ')}.</p>`, 'bad');
    } else {
      setFeedback(`<p>${pair[0]} and ${pair[1]} are not neighbors. Connect the new points in order, just as the control polygon connects P0, P1, P2, P3 in order.</p>`, 'bad');
    }
  }
  updateConnectStatus(step);
  draw();
}

function updateConnectStatus(step) {
  const done = step.segments.filter((seg) => segments.some((s) => sameSegment(s, seg))).length;
  $('status').textContent = `Segments drawn: ${done} of ${step.segments.length}.`;
  if (done === step.segments.length) {
    setFeedback('<p>All connected. Click Next.</p>', 'good');
    finishStep();
  }
}

// --- pick: click the control points of a piece in order; checked after four. ---

function clickPick(step, s) {
  const hit = pointAt(s);
  if (!hit || pending.includes(hit)) return;
  pending.push(hit);
  if (pending.length === step.answer.length) checkPick(step);
  updatePickStatus(step);
  renderTriangle();
  draw();
}

function checkPick(step) {
  const right = pending.every((n, i) => n === step.answer[i]);
  if (right) {
    picks[step.name] = pending.slice();
    setFeedback(`<p>Right: ${step.name} = ${pending.join(', ')}.</p>`, 'good');
    finishStep();
    return;
  }
  // Specific feedback first (wrong ends), then one more hint per attempt.
  let message;
  const first = step.answer[0], last = step.answer[step.answer.length - 1];
  if (pending[0] !== first) {
    message = `${step.name} should start at ${first}.`;
  } else if (pending[pending.length - 1] !== last) {
    message = `${step.name} should end at ${last}.`;
  } else {
    message = 'The ends are right, but the middle points are not.';
  }
  if (misses === 0) addReview(`Picking the control points of ${step.name}`);
  misses++;
  const hints = step.hints.slice(0, misses).map((h) => `<p><strong>Hint:</strong> ${h}</p>`).join('');
  setFeedback(`<p>Not yet: ${pending.join(', ')}. ${message}</p>${hints}<p>Try again.</p>`, 'bad');
  pending = [];
}

function updatePickStatus(step) {
  $('status').textContent = `${step.name} so far: ` +
    (pending.length ? pending.join(', ') : '(none)') +
    ` (${pending.length} of ${step.answer.length})`;
}

// --- trace: predict where the next line segment will be drawn. ---

function clickPredict(step, s) {
  if (!trace || !trace.awaitingPrediction) return;
  const event = trace.events[trace.next];
  const d = screenDistanceToSegment(s, event.pts[0], event.pts[3]);
  if (d <= 18) {
    trace.awaitingPrediction = false;
    trace.predictionsLeft--;
    missedAt = null;
    trace.next++;
    applyEvent(event);
    setFeedback(`<p>Right: the next segment is ${pieceName(event.path)}.</p>`, 'good');
    updateTracePanel(step);
  } else {
    missedAt = toWorld(s);
    if (misses === 0) addReview('Predicting the next line segment in the recursion');
    misses++;
    setFeedback('<p>Not there. Look at the current piece (bold) and the call stack: which piece will be the first to pass the flatness test?</p>' +
      (misses >= 2 ? '<p><strong>Hint:</strong> the recursion always works on the L piece first, and keeps cutting until a piece is flat enough.</p>' : ''), 'bad');
  }
  draw();
}


// -----------------------------------------------------------------------------
// Section 9. The side panel: triangle, stage buttons, start.
// -----------------------------------------------------------------------------

// The de Casteljau triangle, shown in stages 2 to 5 (the Q triangle in
// stage 5). Each placed point shows its name; unplaced points show "?".
// Points chosen for a piece are colored.
function renderTriangle() {
  const step = STEPS[stepIndex];
  const show = step.stage >= 2 && step.stage <= 5 && !currentView().halfCut;
  $('triangle-wrap').style.display = show ? '' : 'none';
  if (!show) return;
  const prefix = step.stage === 5 ? 'Q' : 'P';
  const [first, second] = prefix === 'Q' ? ['QL', 'QR'] : ['L', 'R'];
  const tri = $('triangle');
  tri.innerHTML = '';
  // Which points belong to each piece: finished picks, plus the pick in progress.
  const inA = new Set(picks[first] || []), inB = new Set(picks[second] || []);
  if (step.type === 'pick' && !picks[step.name]) {
    pending.forEach((n) => (step.name === first ? inA : inB).add(n));
  }
  for (let k = 0; k <= 3; k++) {
    for (let i = 0; i <= 3 - k; i++) {
      const name = pointName(prefix, k, i);
      const span = document.createElement('span');
      // Row k sits between the points of the row above: column k + 2i + 1.
      span.style.gridRow = k + 1;
      span.style.gridColumn = k + 2 * i + 1;
      const known = k === 0 || placed.has(name);
      span.textContent = known ? name : '?';
      if (!known) span.className = 'empty';
      else if (inA.has(name) && inB.has(name)) span.className = 'LR';
      else if (inA.has(name)) span.className = 'L';
      else if (inB.has(name)) span.className = 'R';
      tri.appendChild(span);
    }
  }
}

// Buttons to jump to the start of each stage. Jumping fills in everything
// earlier stages build, so an instructor can demonstrate any stage.
function renderStageNav() {
  const nav = $('stage-nav');
  nav.innerHTML = 'Stage:';
  const stages = [...new Set(STEPS.map((s) => s.stage))];
  for (const stage of stages) {
    const button = document.createElement('button');
    button.textContent = stage;
    if (STEPS[stepIndex].stage === stage) button.className = 'current';
    button.addEventListener('click', () => goToStep(STEPS.findIndex((s) => s.stage === stage)));
    nav.appendChild(button);
  }
}

// Start over at step `index`, with the work of every earlier step done.
function goToStep(index) {
  t = 0.3;
  placed = new Set();
  segments = [];
  picks = {};
  chosenHalf = null;
  flatPath = '';
  flatTol = null;
  review = [];
  for (let i = 0; i < index; i++) {
    const step = STEPS[i];
    if (step.type === 'choose-t') t = CUT_T;
    if (step.type === 'choose-half') chosenHalf = 'L';
    if (step.type === 'place') {
      step.targets.forEach((n) => placed.add(n));
      if (step.autoConnect) autoConnect(step.targets[0][0]);
    }
    if (step.type === 'connect') segments.push(...step.segments);
    if (step.type === 'pick') picks[step.name] = step.answer.slice();  }
  stepIndex = index;
  renderStep();
}

// Redraw when the window changes size, and start at the first step.
window.addEventListener('resize', resizeCanvas);
goToStep(0);
resizeCanvas();
