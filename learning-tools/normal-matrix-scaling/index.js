// index.js — "Normals Under Non-Uniform Scaling"
//
// Two spheres, scaled by the same model matrix M = scale(sx, sy, sz).
// They differ in one thing only: how the vertex shader transforms the
// normals.
//   - Left:  n' = mat3(M) * n         (the model matrix: wrong when the
//                                      scaling is non-uniform)
//   - Right: n' = (M⁻¹)ᵀ * n          (the normal matrix: always right)
//
// The program, in sections you can read top to bottom:
//   1. Presets, slider ranges and the page's state
//   2. Matrix and vector helpers (column-major, as in the WebGL examples)
//   3. The sphere
//   4. The shaders
//   5. Drawing each view in WebGL 2 (drawLeft, drawRight, drawSphere)
//   6. The normal lines, the true normals and the error colors (2D overlay)
//   7. The code panel
//   8. The steps panel
//   9. The page: sliders, presets, toggles, resizing
//
// The code panel shows the shader strings of section 4 and the functions
// of section 5 as they are in this file (fn.toString()), so the code on
// screen is the code that runs.

'use strict';

// =====================================================================
// 1. Presets, slider ranges and the page's state
// =====================================================================

// Each preset sets the three scale sliders. The note says what to look for.
const PRESETS = [
  { name: 'Sphere', scale: [1, 1, 1],
    note: 'No scaling. Both views agree: every normal is green.' },
  { name: 'Uniform × 2', scale: [2, 2, 2],
    note: 'Uniform scaling. Both views still agree: M n is twice as long, but it points the right way, and normalizing fixes the length.' },
  { name: 'Stretch x', scale: [3, 1, 1],
    note: 'Left: the normals turn toward the x axis along with the surface. To stay perpendicular, they should turn away from it, as on the right.' },
  { name: 'Squash y', scale: [1, 0.3, 1],
    note: 'A flat disc: the largest errors. On the left, the lighting near the rim is wrong.' },
  { name: 'Mixed', scale: [2, 0.5, 1],
    note: 'A different scale on every axis.' },
];

// The sphere: 12 rows from pole to pole (15° apart) and 16 columns
// around (22.5° apart).
const SPHERE_ROWS = 12;
const SPHERE_COLS = 16;

// The sample vertex used by the steps: row 3, column 2, which is
// latitude 45°, longitude 45°. Its normal is (0.5, 0.707, 0.5).
const SAMPLE_ROW = 3;
const SAMPLE_COL = 2;

const NORMAL_LENGTH = 0.3;        // length of every normal line, in world units
const SAMPLE_ARROW_LENGTH = 0.75; // length of the sample's normal and tangent arrows
const CAMERA_DISTANCE = 8;        // fits a sphere scaled by 3
const FIELD_OF_VIEW = 45 * Math.PI / 180;   // vertical

// The light: a direction in world space, pointing toward the light
// (from the upper left, in front).
const LIGHT_DIRECTION = new Float32Array(normalize([-0.4, 0.6, 0.7]));

// Everything the pictures depend on. The sliders and buttons change it,
// then call requestRender().
const state = {
  scale: [1, 1, 1],
  viewAngle: 30,    // degrees, orbit about the y axis
  viewHeight: 20,   // degrees above the xz plane
  showNormals: true,
  shading: true,
  step: 0,          // which step of the steps panel is shown
  reveal: 0,        // how many derivation lines are shown (step 4)
};

// =====================================================================
// 2. Matrix and vector helpers
//
// Matrices are Float32Arrays in column-major order, as WebGL expects:
// a 4 × 4 matrix is 16 numbers, column 0 first; a 3 × 3 is 9 numbers.
// Element (row r, column c) is m[c * 4 + r] (or m[c * 3 + r]).
// =====================================================================

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function times(v, s) { return [v[0] * s, v[1] * s, v[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1],
          a[2] * b[0] - a[0] * b[2],
          a[0] * b[1] - a[1] * b[0]];
}
function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

// The model matrix: scale by sx, sy, sz along the axes.
function scaleMatrix(sx, sy, sz) {
  return new Float32Array([
    sx, 0,  0,  0,
    0,  sy, 0,  0,
    0,  0,  sz, 0,
    0,  0,  0,  1,
  ]);
}

// The view matrix: puts the eye at the origin, looking down −z.
function lookAt(eye, target, up) {
  const z = normalize(sub(eye, target));   // camera's z axis (backward)
  const x = normalize(cross(up, z));       // camera's x axis (right)
  const y = cross(z, x);                   // camera's y axis (up)
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

// The projection matrix: the lens (vertical field of view, aspect ratio,
// near and far planes).
function perspective(fieldOfView, aspect, near, far) {
  const f = 1 / Math.tan(fieldOfView / 2);
  const rangeInv = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0,                        0,
    0,          f, 0,                        0,
    0,          0, (near + far) * rangeInv, -1,
    0,          0, 2 * near * far * rangeInv, 0,
  ]);
}

// a × b for 4 × 4 matrices.
function multiply4(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

// m × v for a 4 × 4 matrix and a 4-component vector.
function transform4(m, v) {
  const out = [0, 0, 0, 0];
  for (let r = 0; r < 4; r++) {
    out[r] = m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3];
  }
  return out;
}

// The upper-left 3 × 3 of a 4 × 4 matrix: the part that acts on
// directions. It leaves out the translation (column 3). Same as mat3(m)
// in GLSL.
function upperLeft3(m) {
  return new Float32Array([
    m[0], m[1], m[2],
    m[4], m[5], m[6],
    m[8], m[9], m[10],
  ]);
}

// The inverse of a 3 × 3 matrix: the adjugate divided by the determinant.
// Names a … i are the elements row by row:
//   | a b c |
//   | d e f |
//   | g h i |
function inverse3(m) {
  const a = m[0], b = m[3], c = m[6];
  const d = m[1], e = m[4], f = m[7];
  const g = m[2], h = m[5], i = m[8];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  // Written column by column (column-major).
  return new Float32Array([
    (e * i - f * h) / det, (f * g - d * i) / det, (d * h - e * g) / det,
    (c * h - b * i) / det, (a * i - c * g) / det, (b * g - a * h) / det,
    (b * f - c * e) / det, (c * d - a * f) / det, (a * e - b * d) / det,
  ]);
}

// The transpose of a 3 × 3 matrix: rows become columns.
function transpose3(m) {
  return new Float32Array([
    m[0], m[3], m[6],
    m[1], m[4], m[7],
    m[2], m[5], m[8],
  ]);
}

// m × v for a 3 × 3 matrix and a 3-component vector.
function transform3(m, v) {
  return [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ];
}

// =====================================================================
// 3. The sphere
//
// A UV sphere of radius 1 centered at the origin. A point at latitude
// lat and longitude lon is
//   (cos(lat) cos(lon), sin(lat), cos(lat) sin(lon)).
// For a sphere of radius 1 centered at the origin, the normal at a point
// is the point itself (as a direction).
//
// The mesh stores each pole SPHERE_COLS + 1 times and the seam (lon = 0
// and 360°) twice, so the triangles are easy to list. The normal lines
// use `points`, which has each point once.
// =====================================================================

function spherePoint(lat, lon) {
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
}

// The tangent along the line of longitude, toward the north pole: the
// derivative of spherePoint with respect to lat.
function sphereTangent(lat, lon) {
  return [-Math.sin(lat) * Math.cos(lon), Math.cos(lat), -Math.sin(lat) * Math.sin(lon)];
}

function makeSphere(rows, cols) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i <= rows; i++) {
    const lat = Math.PI / 2 - i * Math.PI / rows;   // 90° down to −90°
    for (let j = 0; j <= cols; j++) {
      const lon = j * 2 * Math.PI / cols;
      const p = spherePoint(lat, lon);
      positions.push(...p);
      normals.push(...p);   // normal = position, on this sphere
    }
  }
  // Two triangles per grid cell.
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;    // this row
      const b = a + cols + 1;          // the row below
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  // Each point once, for the normal lines: the two poles, and the rows
  // between them without the repeated seam column.
  const points = [];
  points.push({ p: [0, 1, 0], sample: false });
  for (let i = 1; i < rows; i++) {
    const lat = Math.PI / 2 - i * Math.PI / rows;
    for (let j = 0; j < cols; j++) {
      const lon = j * 2 * Math.PI / cols;
      const point = { p: spherePoint(lat, lon), sample: i === SAMPLE_ROW && j === SAMPLE_COL };
      if (point.sample) point.t = sphereTangent(lat, lon);
      points.push(point);
    }
  }
  points.push({ p: [0, -1, 0], sample: false });

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    points,
  };
}

const sphere = makeSphere(SPHERE_ROWS, SPHERE_COLS);

// =====================================================================
// 4. The shaders (GLSL ES 3.00)
//
// The `// language=GLSL` and `/* glsl */` markers turn on GLSL syntax
// highlighting in JetBrains IDEs and in VS Code. In WebGL 2,
// `#version 300 es` must be the very first line, so it comes right
// after the backtick.
//
// The two vertex shaders are the same except for one line, marked ◀.
// Both views use the same fragment shader.
// =====================================================================

// language=GLSL
const leftVertexShaderSource = /* glsl */ `#version 300 es
in vec3 a_position;
in vec3 a_normal;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

out vec3 v_normal;   // world space

void main() {
  gl_Position = u_projection * u_view * u_model
              * vec4(a_position, 1.0);

  // Transform the normal like the positions:
  // with the upper-left 3 × 3 of the model matrix.
  v_normal = mat3(u_model) * a_normal;   // ◀
}
`;

// language=GLSL
const rightVertexShaderSource = /* glsl */ `#version 300 es
in vec3 a_position;
in vec3 a_normal;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat3 u_normalMatrix;   // (M⁻¹)ᵀ, from JavaScript

out vec3 v_normal;   // world space

void main() {
  gl_Position = u_projection * u_view * u_model
              * vec4(a_position, 1.0);

  // Transform the normal with the normal matrix.
  v_normal = u_normalMatrix * a_normal;   // ◀
}
`;

// language=GLSL
const fragmentShaderSource = /* glsl */ `#version 300 es
precision mediump float;

in vec3 v_normal;

uniform vec3 u_lightDirection;   // unit vector toward the light
uniform bool u_shading;

out vec4 outColor;

void main() {
  // The rasterizer interpolates v_normal between the vertices,
  // which makes it shorter than 1: normalize it again.
  vec3 n = normalize(v_normal);

  vec3 surfaceColor = vec3(0.86, 0.86, 0.9);
  if (u_shading) {
    // Diffuse light (n · light, never below 0) plus a little ambient.
    float diffuse = max(dot(n, u_lightDirection), 0.0);
    outColor = vec4(surfaceColor * (0.15 + 0.85 * diffuse), 1.0);
  } else {
    outColor = vec4(surfaceColor * 0.8, 1.0);   // flat gray
  }
}
`;

// =====================================================================
// 5. Drawing each view in WebGL 2
//
// Each view has its own canvas and WebGL 2 context. createView compiles
// that view's shaders and fills its buffers. drawLeft and drawRight set
// the uniforms for one frame; they are shown in the code panel.
// =====================================================================

// The left view: the shader transforms normals with mat3(u_model),
// so the model matrix is all it needs.
function drawLeft(view, modelMatrix, viewMatrix, projectionMatrix) {
  const gl = view.gl;
  const loc = view.locations;
  gl.useProgram(view.program);
  gl.uniformMatrix4fv(loc.u_model, false, modelMatrix);
  gl.uniformMatrix4fv(loc.u_view, false, viewMatrix);
  gl.uniformMatrix4fv(loc.u_projection, false, projectionMatrix);

  // Normals: nothing else to send.   // ◀
  drawSphere(view);
}

// The right view: compute the normal matrix (M⁻¹)ᵀ here, once per
// frame, and send it to the shader as a mat3.
function drawRight(view, modelMatrix, viewMatrix, projectionMatrix) {
  const gl = view.gl;
  const loc = view.locations;
  gl.useProgram(view.program);
  gl.uniformMatrix4fv(loc.u_model, false, modelMatrix);
  gl.uniformMatrix4fv(loc.u_view, false, viewMatrix);
  gl.uniformMatrix4fv(loc.u_projection, false, projectionMatrix);

  // Normals: the inverse transpose of the upper-left 3 × 3.   // ◀
  const m3 = upperLeft3(modelMatrix);                         // ◀
  const normalMatrix = transpose3(inverse3(m3));              // ◀
  gl.uniformMatrix3fv(loc.u_normalMatrix, false, normalMatrix); // ◀
  drawSphere(view);
}

// Both views: the light, then the draw call.
function drawSphere(view) {
  const gl = view.gl;
  const loc = view.locations;
  gl.uniform3fv(loc.u_lightDirection, LIGHT_DIRECTION);
  gl.uniform1i(loc.u_shading, state.shading ? 1 : 0);

  gl.bindVertexArray(view.vao);
  gl.drawElements(gl.TRIANGLES, view.indexCount, gl.UNSIGNED_SHORT, 0);
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  return program;
}

// side is 'left' or 'right'. Returns null if WebGL 2 is not available.
function createView(side) {
  const figure = document.getElementById('view-' + side);
  const canvas = figure.querySelector('canvas.gl');
  const overlay = figure.querySelector('canvas.overlay');
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) return null;

  const vertexSource = side === 'left' ? leftVertexShaderSource : rightVertexShaderSource;
  const program = createProgram(gl, vertexSource, fragmentShaderSource);

  const locations = {};
  for (const name of ['u_model', 'u_view', 'u_projection', 'u_normalMatrix',
                      'u_lightDirection', 'u_shading']) {
    locations[name] = gl.getUniformLocation(program, name);   // null if unused
  }

  // One vertex array object holds both attributes and the index buffer.
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  function attribute(name, data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
  }
  attribute('a_position', sphere.positions);
  attribute('a_normal', sphere.normals);
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  gl.enable(gl.DEPTH_TEST);

  return {
    side, figure, canvas, overlay, gl, program, locations, vao,
    indexCount: sphere.indices.length,
    readout: figure.querySelector('.readout'),
  };
}

// Where the camera is, from the two view sliders. It always looks at the
// origin, the sphere's center.
function cameraEye() {
  const a = state.viewAngle * Math.PI / 180;
  const h = state.viewHeight * Math.PI / 180;
  return [CAMERA_DISTANCE * Math.cos(h) * Math.sin(a),
          CAMERA_DISTANCE * Math.sin(h),
          CAMERA_DISTANCE * Math.cos(h) * Math.cos(a)];
}

// Make a canvas's drawing buffer match its CSS size × devicePixelRatio.
function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

// =====================================================================
// 6. The normal lines, the true normals and the error colors
//
// The normal lines are drawn on a 2D canvas over each WebGL canvas, so
// they can be thick and colored by their error. (WebGL lines are always
// 1 pixel wide in most browsers.) The 2D canvas has no depth test, so
// normals on the far side of the shape are hidden instead: for a convex
// shape, a point faces the camera when its true normal points toward the
// eye.
// =====================================================================

// The same math as the ◀ line of each vertex shader, in JavaScript,
// then normalized (so only the direction is compared).
function leftNormal(modelMatrix, n) {
  return normalize(transform3(upperLeft3(modelMatrix), n));
}
function rightNormal(modelMatrix, n) {
  return normalize(transform3(transpose3(inverse3(upperLeft3(modelMatrix))), n));
}

// The true normal of the ellipsoid at point q, found a different way, so
// the check does not compare the right view with itself. The ellipsoid
// is  (x/sx)² + (y/sy)² + (z/sz)² = 1,  and the normal at a point of a
// surface f(x, y, z) = 1 is the gradient of f:
//   (2x/sx², 2y/sy², 2z/sz²),  or after normalizing, the same without the 2.
function trueNormal(scale, q) {
  return normalize([q[0] / (scale[0] * scale[0]),
                    q[1] / (scale[1] * scale[1]),
                    q[2] / (scale[2] * scale[2])]);
}

// The angle between two unit vectors, in degrees.
function angleBetween(a, b) {
  return Math.acos(Math.min(1, Math.max(-1, dot(a, b)))) * 180 / Math.PI;
}

// Error color and line width: green at 0°, through yellow, to red at 30°
// and more. Wrong normals are also darker and thicker, so the scale does
// not rely on hue alone.
const ERROR_FULL = 30;
function errorStyle(degrees) {
  const t = Math.min(degrees / ERROR_FULL, 1);
  const hue = 130 * (1 - t);
  const lightness = 40 - 10 * t;
  return { color: `hsl(${hue}, 75%, ${lightness}%)`, width: 1.5 + 2.5 * t };
}

const TANGENT_COLOR = '#1f5fbf';

// Draws the overlay for one view. Returns the worst error over all
// normals (seen or not) and the cosine of the angle between n' and t'
// at the sample vertex.
function drawOverlay(view, modelMatrix, viewProjection, eye) {
  const canvas = view.overlay;
  fitCanvas(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // World space → CSS pixels on this canvas.
  function toScreen(q) {
    const clip = transform4(viewProjection, [q[0], q[1], q[2], 1]);
    return [(clip[0] / clip[3] + 1) / 2 * w, (1 - clip[1] / clip[3]) / 2 * h];
  }

  const m3 = upperLeft3(modelMatrix);
  let worst = 0;
  let sample = null;

  ctx.lineCap = 'round';
  for (const point of sphere.points) {
    const q = transform3(m3, point.p);              // the point on the ellipsoid
    const nTrue = trueNormal(state.scale, q);
    const n = view.side === 'left' ? leftNormal(modelMatrix, point.p)
                                   : rightNormal(modelMatrix, point.p);
    const error = angleBetween(n, nTrue);
    worst = Math.max(worst, error);
    const facing = dot(nTrue, sub(eye, q)) > 0;
    if (point.sample) {
      sample = { q, n, error, facing, t: normalize(transform3(m3, point.t)) };
      continue;
    }
    if (!state.showNormals || !facing) continue;
    const style = errorStyle(error);
    const a = toScreen(q);
    const b = toScreen(add(q, times(n, NORMAL_LENGTH)));
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }

  // The sample vertex: its normal n', its tangent t' = M t, and a dot.
  // Faded when it is on the far side.
  ctx.globalAlpha = sample.facing ? 1 : 0.35;
  const base = toScreen(sample.q);
  drawArrow(ctx, base, toScreen(add(sample.q, times(sample.t, SAMPLE_ARROW_LENGTH))),
            TANGENT_COLOR, 2.5, 't′');
  const style = errorStyle(sample.error);
  drawArrow(ctx, base, toScreen(add(sample.q, times(sample.n, SAMPLE_ARROW_LENGTH))),
            style.color, Math.max(2.5, style.width), 'n′');
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(base[0], base[1], 4.5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.globalAlpha = 1;

  return { worst, sampleCos: dot(sample.n, sample.t) };
}

// An arrow from a to b (in CSS pixels) with a label past its tip.
function drawArrow(ctx, a, b, color, width, label) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  const head = 11;
  function shaft() {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0] - ux * head * 0.6, b[1] - uy * head * 0.6);
  }
  function arrowHead() {
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(b[0] - ux * head - uy * head * 0.5, b[1] - uy * head + ux * head * 0.5);
    ctx.lineTo(b[0] - ux * head + uy * head * 0.5, b[1] - uy * head - ux * head * 0.5);
    ctx.closePath();
  }
  // A white outline first, so the arrow stands out from the other normals.
  ctx.strokeStyle = 'white';
  ctx.lineWidth = width + 4;
  shaft();
  ctx.stroke();
  ctx.lineWidth = 4;
  arrowHead();
  ctx.stroke();
  // Then the arrow itself.
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  shaft();
  ctx.stroke();
  arrowHead();
  ctx.fill();
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.strokeText(label, b[0] + ux * 12, b[1] + uy * 12);
  ctx.fillText(label, b[0] + ux * 12, b[1] + uy * 12);
}

// =====================================================================
// 7. The code panel
//
// Shows the shader strings and the drawing functions exactly as they are
// in this file. Lines marked ◀ (the difference between the views) are
// highlighted; comments are gray.
// =====================================================================

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function codeToHtml(source) {
  return source.replace(/\s+$/, '').split('\n').map(line => {
    const at = line.indexOf('//');
    let html = at < 0 ? escapeHtml(line)
      : escapeHtml(line.slice(0, at)) + '<span class="comment">' + escapeHtml(line.slice(at)) + '</span>';
    if (line.includes('◀')) html = '<span class="diff">' + html + '</span>';
    return html;
  }).join('\n');
}

function codeBlock(title, source) {
  return `<h3>${title}</h3><pre class="code">${codeToHtml(source)}</pre>`;
}

function buildCodePanel() {
  document.getElementById('code-left').innerHTML =
    codeBlock('Vertex shader (GLSL)', leftVertexShaderSource) +
    codeBlock('Setting the uniforms (JavaScript)', drawLeft.toString());
  document.getElementById('code-right').innerHTML =
    codeBlock('Vertex shader (GLSL)', rightVertexShaderSource) +
    codeBlock('Setting the uniforms (JavaScript)', drawRight.toString());
  document.getElementById('code-shared').innerHTML =
    '<div>' + codeBlock('Fragment shader (GLSL)', fragmentShaderSource) + '</div>' +
    '<div>' + codeBlock('The draw call (JavaScript)', drawSphere.toString()) + '</div>';
}

// =====================================================================
// 8. The steps panel
//
// Seven steps, one at a time. Step 4 shows its derivation one line at a
// time: Next shows the next line before moving on. A step's "Try it"
// button applies a preset; steps never change the sliders by themselves.
// Elements with data-live are filled with numbers from the views.
// =====================================================================

// A 3 × 3 matrix in brackets, for the steps (rows of strings).
function matrixHtml(rows) {
  return '<table class="matrix">' + rows.map(r =>
    '<tr>' + r.map(x => `<td>${x}</td>`).join('') + '</tr>').join('') + '</table>';
}

const STEPS = [
  {
    title: 'What a normal is',
    tryIt: 0,
    html: `
      <p>A <b>vertex normal</b> is a unit vector perpendicular to the surface
        at that vertex. Perpendicular means it makes a right angle with every
        <b>tangent</b> there, that is, every direction along the surface:</p>
      <p class="eq">n · t = 0</p>
      <p>The dark dot in each view is one sample vertex. Its normal and one
        tangent are drawn as arrows, labeled n′ and t′ (the transformed
        n and t). With no scaling, n′ = n and t′ = t, and they meet at a
        right angle.</p>`,
  },
  {
    title: 'Tangents move with the surface',
    tryIt: 2,
    html: `
      <p>A tangent is a direction along the surface. When the model matrix
        scales the surface, the tangent goes with it:</p>
      <p class="eq">t′ = M t</p>
      <p>Here M is the upper-left 3 × 3 of the model matrix. A tangent is a
        direction, not a point, so translation does not apply to it.</p>
      <p>Look at the blue arrow: it turns with the surface, the same way in
        both views.</p>`,
  },
  {
    title: 'Try n′ = M n',
    tryIt: 2,
    html: `
      <p>The left view transforms the normal the same way as the tangent:
        n′ = M n. Is it still perpendicular to t′? At the sample vertex:</p>
      <table class="live">
        <tr><th>left: n′ = M n</th>
          <td>n′ · t′ = <b data-live="leftCos">…</b></td>
          <td>angle <b data-live="leftAngle">…</b></td></tr>
        <tr><th>right: n′ = (M⁻¹)ᵀ n</th>
          <td>n′ · t′ = <b data-live="rightCos">…</b></td>
          <td>angle <b data-live="rightAngle">…</b></td></tr>
      </table>
      <p class="hint">Both vectors are normalized, so n′ · t′ is the cosine of
        the angle between them. Perpendicular: n′ · t′ = 0, an angle of 90°.</p>
      <p>With uniform scaling the left value is 0. With non-uniform scaling it
        is not. Scaling by 3 along x (Try it) turns the surface toward the
        x direction, so a normal, which must stay perpendicular, should turn
        away from it. But M n multiplies the normal's x component by 3, which
        turns it toward the x direction.</p>`,
  },
  {
    title: 'Find the matrix that keeps them perpendicular',
    tryIt: null,
    html: `
      <p>We want a matrix N so that n′ = N n is perpendicular to every
        t′ = M t. Start from what we know before scaling: n is perpendicular
        to t.</p>`,
    lines: [
      { eq: 'n · t = nᵀ t = 0',
        why: 'Write the dot product as a matrix product: the row nᵀ times the column t.' },
      { eq: 'nᵀ t = nᵀ (M⁻¹ M) t',
        why: 'M⁻¹ M is the identity matrix, so putting it in changes nothing.' },
      { eq: '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= (nᵀ M⁻¹) (M t)',
        why: 'A product of matrices can be grouped either way.' },
      { eq: '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= ((M⁻¹)ᵀ n)ᵀ (M t)',
        why: 'The transpose rule (AB)ᵀ = Bᵀ Aᵀ gives ((M⁻¹)ᵀ n)ᵀ = nᵀ M⁻¹.' },
      { eq: '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= n′ᵀ t′,&nbsp; with n′ = (M⁻¹)ᵀ n and t′ = M t',
        why: 'So n′ · t′ = n · t = 0 for every tangent. N = (M⁻¹)ᵀ, the inverse transpose of M, is the <b>normal matrix</b>.' },
    ],
  },
  {
    title: 'What it is for scaling',
    tryIt: 3,
    html: `
      <p>For M = scale(s<sub>x</sub>, s<sub>y</sub>, s<sub>z</sub>):</p>
      <div class="matrices">
        <span>M =</span>${matrixHtml([['s<sub>x</sub>', '0', '0'], ['0', 's<sub>y</sub>', '0'], ['0', '0', 's<sub>z</sub>']])}
        <span>M⁻¹ = (M⁻¹)ᵀ =</span>${matrixHtml([['1/s<sub>x</sub>', '0', '0'], ['0', '1/s<sub>y</sub>', '0'], ['0', '0', '1/s<sub>z</sub>']])}
      </div>
      <p>The inverse of a scale scales by the reciprocals, and a diagonal
        matrix is its own transpose. So the normal matrix scales the normal by
        1/s<sub>x</sub>, 1/s<sub>y</sub>, 1/s<sub>z</sub>: the normal shrinks
        along the axis the surface is stretched along, and grows along the
        axis the surface is squashed along. That is the opposite of what
        M does.</p>
      <p>Try it: Squash y. The surface is squashed along y, so on the right
        the normals turn toward the y axis: over most of the disc they point
        almost straight up or down. On the left they turn away from it.</p>`,
  },
  {
    title: 'Special cases',
    tryIt: 1,
    html: `
      <ul>
        <li><b>Uniform scaling</b>, M = s I: (M⁻¹)ᵀ = (1/s) I. Then M n and
          (M⁻¹)ᵀ n point the same way; only their lengths differ, and
          normalizing fixes that. This is why both views agree in
          Uniform × 2 (Try it).</li>
        <li><b>Rotation</b> R: R⁻¹ = Rᵀ, so (R⁻¹)ᵀ = R. The model matrix
          already works.</li>
        <li><b>Translation</b>: left out by taking the upper-left 3 × 3.
          Normals are directions, not points, so they must not be
          moved.</li>
      </ul>
      <p>A model matrix that mixes rotations, translations and non-uniform
        scaling needs the normal matrix. (M⁻¹)ᵀ works for any M that has an
        inverse.</p>`,
  },
  {
    title: 'In practice',
    tryIt: null,
    html: `
      <ul>
        <li>Compute the normal matrix in JavaScript whenever the model matrix
          changes (once per frame or per object) and send it with
          <code>gl.uniformMatrix3fv</code>, as <code>drawRight</code> does.
          GLSL ES 3.00 has <code>inverse</code> and <code>transpose</code>,
          but calling them in the vertex shader repeats the work for every
          vertex.</li>
        <li>Normalize after transforming. The fragment shader normalizes
          again, because the rasterizer interpolates between unit vectors,
          which gives vectors shorter than 1.</li>
        <li>This page lights in world space, so it uses M. If your lighting
          is done in camera space, use the normal matrix of the model-view
          matrix: ((V M)⁻¹)ᵀ, from the upper-left 3 × 3 of V M.</li>
      </ul>`,
  },
];

function renderStep() {
  const step = STEPS[state.step];
  const lineCount = step.lines ? step.lines.length : 0;
  document.getElementById('step-count').textContent =
    `Step ${state.step + 1} of ${STEPS.length}` +
    (lineCount ? ` · line ${state.reveal} of ${lineCount}` : '');
  document.getElementById('step-title').textContent = step.title;

  let html = step.html;
  if (lineCount) {
    html += '<ol class="derive">' + step.lines.slice(0, state.reveal).map(line =>
      `<li><div class="eq">${line.eq}</div><div class="why">${line.why}</div></li>`).join('') + '</ol>';
  }
  document.getElementById('step-body').innerHTML = html;

  const tryButton = document.getElementById('step-try');
  if (step.tryIt === null) {
    tryButton.hidden = true;
  } else {
    tryButton.hidden = false;
    tryButton.textContent = 'Try it: ' + PRESETS[step.tryIt].name;
  }

  const last = state.step === STEPS.length - 1;
  const moreLines = lineCount && state.reveal < lineCount;
  document.getElementById('step-back').disabled = state.step === 0 && state.reveal <= (lineCount ? 1 : 0);
  document.getElementById('step-next').disabled = last && !moreLines;
  document.getElementById('step-next').textContent = moreLines ? 'Next line' : 'Next';
  updateLive();
}

function goToStep(index, atEnd) {
  state.step = index;
  const lines = STEPS[index].lines;
  state.reveal = lines ? (atEnd ? lines.length : 1) : 0;
  renderStep();
}

function nextStep() {
  const lines = STEPS[state.step].lines;
  if (lines && state.reveal < lines.length) {
    state.reveal++;
    renderStep();
  } else if (state.step < STEPS.length - 1) {
    goToStep(state.step + 1, false);
  }
}

function previousStep() {
  const lines = STEPS[state.step].lines;
  if (lines && state.reveal > 1) {
    state.reveal--;
    renderStep();
  } else if (state.step > 0) {
    goToStep(state.step - 1, true);
  }
}

// The latest numbers from the views, for data-live elements.
const live = { leftCos: 0, rightCos: 0 };

function updateLive() {
  const format = cos => {
    const value = Math.abs(cos) < 0.005 ? 0 : cos;
    return value.toFixed(2).replace('-', '−');
  };
  const angle = cos => (Math.acos(Math.min(1, Math.max(-1, cos))) * 180 / Math.PI).toFixed(1) + '°';
  const values = {
    leftCos: format(live.leftCos), leftAngle: angle(live.leftCos),
    rightCos: format(live.rightCos), rightAngle: angle(live.rightCos),
  };
  for (const el of document.querySelectorAll('[data-live]')) {
    el.textContent = values[el.dataset.live];
  }
}

// =====================================================================
// 9. The page: sliders, presets, toggles, resizing
// =====================================================================

let views = [];
let renderPending = false;

function requestRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    render();
  });
}

function render() {
  const modelMatrix = scaleMatrix(state.scale[0], state.scale[1], state.scale[2]);
  const eye = cameraEye();
  const viewMatrix = lookAt(eye, [0, 0, 0], [0, 1, 0]);

  for (const view of views) {
    const gl = view.gl;
    fitCanvas(view.canvas);
    gl.viewport(0, 0, view.canvas.width, view.canvas.height);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = view.canvas.clientWidth / view.canvas.clientHeight;
    const projectionMatrix = perspective(FIELD_OF_VIEW, aspect, 0.1, 50);

    if (view.side === 'left') drawLeft(view, modelMatrix, viewMatrix, projectionMatrix);
    else drawRight(view, modelMatrix, viewMatrix, projectionMatrix);

    const result = drawOverlay(view, modelMatrix, multiply4(projectionMatrix, viewMatrix), eye);
    const worst = result.worst < 0.05 ? '0.0' : result.worst.toFixed(1);
    view.readout.innerHTML = `worst normal: <b>${worst}°</b> from the true normal`;
    view.readout.classList.toggle('bad', result.worst >= 0.05);
    live[view.side + 'Cos'] = result.sampleCos;
  }
  updateLive();
}

// Slider ids and how each one sets the state.
const SLIDERS = [
  { id: 'scale-x', set: v => { state.scale[0] = v; }, get: () => state.scale[0], digits: 2 },
  { id: 'scale-y', set: v => { state.scale[1] = v; }, get: () => state.scale[1], digits: 2 },
  { id: 'scale-z', set: v => { state.scale[2] = v; }, get: () => state.scale[2], digits: 2 },
  { id: 'view-angle', set: v => { state.viewAngle = v; }, get: () => state.viewAngle, digits: 0, unit: '°' },
  { id: 'view-height', set: v => { state.viewHeight = v; }, get: () => state.viewHeight, digits: 0, unit: '°' },
];

function showSliderValues() {
  for (const s of SLIDERS) {
    const input = document.getElementById(s.id);
    input.value = s.get();
    document.getElementById(s.id + '-value').textContent =
      s.get().toFixed(s.digits).replace('-', '−') + (s.unit || '');
  }
}

// Set the preset menu to the preset that matches the sliders, if any.
function showPreset() {
  const menu = document.getElementById('preset');
  const index = PRESETS.findIndex(p => p.scale.every((v, i) => Math.abs(v - state.scale[i]) < 1e-6));
  menu.value = index < 0 ? 'custom' : String(index);
  document.getElementById('preset-note').textContent =
    index < 0 ? 'Your own scale.' : PRESETS[index].note;
}

function applyPreset(index) {
  state.scale = PRESETS[index].scale.slice();
  showSliderValues();
  showPreset();
  requestRender();
}

function setUpPage() {
  const menu = document.getElementById('preset');
  PRESETS.forEach((p, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `${p.name} (${p.scale.join(', ')})`;
    menu.appendChild(option);
  });
  const custom = document.createElement('option');
  custom.value = 'custom';
  custom.textContent = 'Your own';
  custom.disabled = true;
  menu.appendChild(custom);
  menu.addEventListener('change', () => applyPreset(Number(menu.value)));

  for (const s of SLIDERS) {
    document.getElementById(s.id).addEventListener('input', event => {
      s.set(Number(event.target.value));
      showSliderValues();
      showPreset();
      requestRender();
    });
  }
  document.getElementById('show-normals').addEventListener('change', event => {
    state.showNormals = event.target.checked;
    requestRender();
  });
  document.getElementById('shading').addEventListener('change', event => {
    state.shading = event.target.checked;
    requestRender();
  });

  document.getElementById('step-next').addEventListener('click', nextStep);
  document.getElementById('step-back').addEventListener('click', previousStep);
  document.getElementById('step-try').addEventListener('click', () => {
    applyPreset(STEPS[state.step].tryIt);
  });

  showSliderValues();
  showPreset();
  buildCodePanel();
  goToStep(0, false);

  views = ['left', 'right'].map(createView);
  if (views.some(v => v === null)) {
    views = [];
    document.getElementById('no-webgl').hidden = false;
    return;
  }
  new ResizeObserver(requestRender).observe(document.getElementById('views'));
  requestRender();
}

setUpPage();
