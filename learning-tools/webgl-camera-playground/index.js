// =============================================================================
// index.js — An interactive playground for the WebGL camera: lookAt and
// perspective.
//
// THE BIG IDEA
// ------------
// A WebGL camera is two matrices that the vertex shader uses:
//
//   gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
//
//   VIEW matrix       : lookAt(eye, target, up). It builds the camera's own
//                       three axes, then moves the whole world so the eye
//                       is at the origin, looking down the camera's -z axis.
//                       (world space -> camera space)
//   PROJECTION matrix : perspective(fieldOfView, aspect, near, far). The
//                       lens: how wide the camera sees, and how near and how
//                       far. (camera space -> clip space)
//
// lookAt builds the camera axes from eye, target and up like this:
//
//   zAxis = normalize(eye - target)     points BACKWARD (from target to eye)
//   xAxis = normalize(cross(up, zAxis)) points to the camera's RIGHT
//   yAxis = cross(zAxis, xAxis)         points to the camera's UP
//
// HOW THIS TOOL WORKS
// -------------------
// Every time a slider changes, update() (section 8) does four things with
// the same numbers:
//   - draws the CAMERA VIEW with real WebGL 2, using exactly these matrices;
//   - draws the WORLD VIEW: the same scene seen by a second, outside
//     viewpoint, with the camera, its axes and its frustum drawn in;
//   - writes the CODE that sets up this camera, with the current numbers;
//   - checks whether the camera can be built at all, and says why not.
//
// FILE OUTLINE
//   Section 1. Presets and slider ranges.
//   Section 2. The program state.
//   Section 3. Vector and matrix math, by hand.
//   Section 4. WebGL 2 setup: shaders, the cube, the scene.
//   Section 5. Drawing the camera view.
//   Section 6. Drawing the world view.
//   Section 7. The code panel and the definition panel.
//   Section 8. Controls, linked highlighting, and update().
// =============================================================================


// -----------------------------------------------------------------------------
// Section 1. Presets and slider ranges.
// -----------------------------------------------------------------------------
// Each preset sets every camera slider. The note says what to look for.
// The scene is the one from the camera-move example: a floor, a tower in
// the center, and three smaller boxes. Its center is near (0, 0.5, 0).

const START = {
  eye: [9, 4, 0], target: [0, 0.5, 0], up: [0, 1, 0],
  fovDeg: 45, near: 0.5, far: 15, aspect: 'canvas',
};

// Make a preset that is START with a few values changed.
function startWith(changes) {
  return Object.assign({}, START, changes);
}

const PRESETS = [
  { name: 'Start', ...START,
    note: 'The camera from the camera-move example, at its starting point. ' +
          'It looks slightly down, so the up vector (0, 1, 0) is not ' +
          'perpendicular to the view direction. That is fine.' },
  { name: 'Target farther along the same line', ...startWith({ target: [-5.4, -1.6, 0] }),
    note: 'The target moved farther away, along the same line from the eye. ' +
          'The camera view does not change: lookAt only uses the direction ' +
          'from the eye to the target, not the distance.' },
  { name: 'Rolled camera', ...startWith({ up: [0, 1, 0.5] }),
    note: 'Only the up vector changed, to (0, 1, 0.5). The camera rolls: it ' +
          'turns about its view direction.' },
  { name: 'Up vector tilted forward (same picture)', ...startWith({ up: [-0.6, 0.6, 0] }),
    note: 'The up vector (-0.6, 0.6, 0) leans toward the view direction, and ' +
          'is not a unit vector. The camera view is the same as Start: the ' +
          'cross product ignores the part of up that is parallel to the view ' +
          'direction, and normalize fixes the length.' },
  { name: 'Looking straight down (broken)', ...startWith({ eye: [0, 12, 0], target: [0, 0, 0] }),
    note: 'The eye is straight above the target, so the view direction is ' +
          '(0, -1, 0): parallel to the up vector. cross(up, zAxis) is the zero ' +
          'vector, which cannot be normalized, so lookAt cannot build the ' +
          'camera\'s x axis.' },
  { name: 'Looking straight down (fixed)', ...startWith({ eye: [0, 12, 0], target: [0, 0, 0], up: [0, 0, -1] }),
    note: 'Same eye and target, with up = (0, 0, -1). Now the up vector is ' +
          'perpendicular to the view direction, and the top of the camera ' +
          'view faces -Z in the world.' },
  { name: 'Wide-angle lens (100°)', ...startWith({ fovDeg: 100 }),
    note: 'A vertical field of view of 100°. The frustum is wider, the boxes ' +
          'look smaller, and shapes near the edges look stretched. The camera ' +
          'did not move.' },
  { name: 'Zoomed-in lens (20°)', ...startWith({ fovDeg: 20 }),
    note: 'A vertical field of view of 20°. The frustum is narrow and the ' +
          'tower fills the view, like a zoom lens. The camera did not move.' },
  { name: 'Near plane cuts the tower', ...startWith({ near: 9.6 }),
    note: 'The near plane is 9.6 in front of the eye, which passes through ' +
          'the tower. The part of the tower in front of the near plane is ' +
          'clipped, so you can see inside it.' },
  { name: 'Far plane cuts the scene', ...startWith({ far: 10.5 }),
    note: 'The far plane is 10.5 in front of the eye. Everything farther away ' +
          'is clipped: the back of the floor, all of the teal box, and part ' +
          'of the yellow box.' },
];

// The sliders. `link` names what the slider belongs to; the same name is
// used by the code lines and the world-view objects, so all three can light
// up together (section 8). get / set read and write the program state.
function vectorSliders(link, min, max, step, digits) {
  return ['x', 'y', 'z'].map((label, i) => ({
    group: link, link, label, min, max, step, digits,
    get: () => state[link][i],
    set: (v) => { state[link][i] = v; },
  }));
}

const SLIDERS = [
  ...vectorSliders('eye',    -15, 15, 0.1, 1),
  ...vectorSliders('target', -10, 10, 0.1, 1),
  // The up vector is not normalized by its sliders: lookAt does not need
  // a unit up vector.
  ...vectorSliders('up',      -1,  1, 0.05, 2),
  { group: 'lens', link: 'fov', label: 'field of view', min: 10, max: 120, step: 1, digits: 0, unit: '°',
    get: () => state.fovDeg, set: (v) => { state.fovDeg = v; } },
  { group: 'lens', link: 'near', label: 'near', min: 0.1, max: 10, step: 0.1, digits: 1,
    get: () => state.near, set: (v) => { state.near = v; } },
  { group: 'lens', link: 'far', label: 'far', min: 1, max: 60, step: 0.5, digits: 1,
    get: () => state.far, set: (v) => { state.far = v; } },
  // The world view's own viewpoint. These never change the camera.
  { group: 'world', link: null, label: 'angle', min: 0, max: 360, step: 1, digits: 0, unit: '°',
    get: () => state.world.angleDeg, set: (v) => { state.world.angleDeg = v; } },
  { group: 'world', link: null, label: 'height', min: 0, max: 30, step: 0.5, digits: 1,
    get: () => state.world.height, set: (v) => { state.world.height = v; } },
  { group: 'world', link: null, label: 'distance', min: 10, max: 60, step: 1, digits: 0,
    get: () => state.world.distance, set: (v) => { state.world.distance = v; } },
];


// -----------------------------------------------------------------------------
// Section 2. The program state.
// -----------------------------------------------------------------------------
// Everything on the page is drawn from this one object. The code panel
// reads the same numbers as the renderer, so the code and the pictures
// always agree.

const state = {
  eye: [], target: [], up: [],     // the three arguments of lookAt
  fovDeg: 45,                      // vertical field of view, in degrees
  near: 0.5, far: 15,              // near and far planes
  aspect: 'canvas',                // 'canvas', or a fixed number as text
  world: { angleDeg: 40, height: 8, distance: 18 },   // the world view's viewpoint
  detail: null,                    // the open definition panel: 'lookAt', 'perspective',
                                   // 'sendView', 'sendProj', or null
  highlight: null,                 // the link name that is lit up, or null
};

// Copy a preset into the state (copying the arrays, so sliders can't
// change the preset itself).
function applyPreset(preset) {
  state.eye = preset.eye.slice();
  state.target = preset.target.slice();
  state.up = preset.up.slice();
  state.fovDeg = preset.fovDeg;
  state.near = preset.near;
  state.far = preset.far;
  state.aspect = preset.aspect;
}


// -----------------------------------------------------------------------------
// Section 3. Vector and matrix math, by hand.
// -----------------------------------------------------------------------------
// A 4x4 matrix is stored as 16 numbers in COLUMN-MAJOR order: the first 4
// numbers are the first column, the next 4 the second column, and so on.
// lookAt and perspective are the same as in the camera-move example.

// --- 3D vector helpers ---
function add(a, b)      { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(v, s)    { return [v[0] * s, v[1] * s, v[2] * s]; }
function dot(a, b)      { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function length(v)      { return Math.sqrt(dot(v, v)); }
function cross(a, b) {
  // The cross product gives a vector perpendicular to both a and b.
  // Its length is |a| |b| sin(angle), so it is the zero vector when a and
  // b are parallel.
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function normalize(v) {
  // Scale a vector so its length is exactly 1 (keep its direction).
  // A zero vector has no direction, so this divides by zero (NaN).
  const len = length(v);
  return [v[0] / len, v[1] / len, v[2] / len];
}

// VIEW matrix: the camera's axes are its ROWS (upper-left 3x3), and the
// last column moves the eye to the origin. See the camera-move example
// for the full explanation.
function lookAt(eye, target, up) {
  const zAxis = normalize(subtract(eye, target));
  const xAxis = normalize(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);   // already length 1

  return new Float32Array([
    xAxis[0], yAxis[0], zAxis[0], 0,   // column 1
    xAxis[1], yAxis[1], zAxis[1], 0,   // column 2
    xAxis[2], yAxis[2], zAxis[2], 0,   // column 3
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,   // column 4
  ]);
}

// PROJECTION matrix. fieldOfView is VERTICAL, in radians; aspect is
// width / height. It squeezes the view frustum into the cube from -1 to +1
// (after the divide by w), and sets w = -z so distant things look smaller.
function perspective(fieldOfView, aspect, near, far) {
  const f = 1.0 / Math.tan(fieldOfView / 2);
  const rangeInv = 1.0 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0,                          0,    // column 1
    0,          f, 0,                          0,    // column 2
    0,          0, (near + far) * rangeInv,   -1,    // column 3
    0,          0, 2 * near * far * rangeInv,  0,    // column 4
  ]);
}

// lookAt itself (like most real code) does not check its arguments. This
// function does the same steps one at a time and stops at the first one
// that fails, so the tool can say why the camera can't be built.
const TINY = 1e-6;
function checkCamera(eye, target, up) {
  const result = { ok: false, problem: null, eyeMinusTarget: subtract(eye, target),
                   crossUpZ: null, zAxis: null, xAxis: null, yAxis: null, upAngleDeg: null };
  if (length(result.eyeMinusTarget) < TINY) {
    result.problem = 'eye-is-target';   // no view direction at all
    return result;
  }
  result.zAxis = normalize(result.eyeMinusTarget);
  if (length(up) < TINY) {
    result.problem = 'zero-up';
    result.crossUpZ = [0, 0, 0];
    return result;
  }
  // The angle between the up vector and the view direction (which is -z).
  const cosine = dot(normalize(up), scale(result.zAxis, -1));
  result.upAngleDeg = Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
  result.crossUpZ = cross(up, result.zAxis);
  if (length(result.crossUpZ) < TINY) {
    result.problem = 'up-parallel';
    return result;
  }
  result.xAxis = normalize(result.crossUpZ);
  result.yAxis = cross(result.zAxis, result.xAxis);
  result.ok = true;
  return result;
}

// Multiply two 4x4 matrices (both column-major): the result does b first,
// then a.
function multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

// Multiply a matrix by the point (x, y, z, 1). Returns [x, y, z, w].
function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8]  * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9]  * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15],
  ];
}

// MODEL matrix: scale the unit cube, then move it to `position`.
function makeModelMatrix(position, size) {
  const [tx, ty, tz] = position;
  const [sx, sy, sz] = size;
  return new Float32Array([
    sx, 0,  0,  0,
    0,  sy, 0,  0,
    0,  0,  sz, 0,
    tx, ty, tz, 1,
  ]);
}

// The camera's PLACEMENT in the world: its axes are the COLUMNS, and the
// eye is the translation. This is the inverse of the view matrix; we use it
// to draw the camera's body in the world view.
function cameraPlacement(cam, eye) {
  const { xAxis: x, yAxis: y, zAxis: z } = cam;
  return new Float32Array([
    x[0], x[1], x[2], 0,
    y[0], y[1], y[2], 0,
    z[0], z[1], z[2], 0,
    eye[0], eye[1], eye[2], 1,
  ]);
}

// A point given in camera coordinates (along the camera's own axes),
// returned in world coordinates.
function cameraToWorld(cam, eye, cx, cy, cz) {
  return add(eye, add(scale(cam.xAxis, cx), add(scale(cam.yAxis, cy), scale(cam.zAxis, cz))));
}


// -----------------------------------------------------------------------------
// Section 4. WebGL 2 setup: shaders, the cube, the scene.
// -----------------------------------------------------------------------------
// There are two WebGL canvases (world view and camera view). Each one gets
// its own WebGL 2 context, and a buffer or a shader program belongs to the
// context that made it. So createRenderer() runs once per canvas, and each
// one uploads its own copy of the cube.
//
// The "// language=GLSL" and "/* glsl */" comments tell your editor to color
// the strings as GLSL. They don't change what the program does.

// language=GLSL
const vertexShaderSource = /* glsl */ `#version 300 es
  in vec3 a_position;    // cube corner, in the cube's own space
  in float a_shade;      // brightness of this vertex's face

  uniform mat4 u_model;       // object space -> world space
  uniform mat4 u_view;        // world space  -> camera space   (lookAt)
  uniform mat4 u_projection;  // camera space -> clip space     (perspective)

  out float v_shade;

  void main() {
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
    v_shade = a_shade;
  }
`;

// language=GLSL
const fragmentShaderSource = /* glsl */ `#version 300 es
  precision mediump float;

  uniform vec3 u_color;
  in float v_shade;
  out vec4 outColor;

  void main() {
    // A fixed brightness per face instead of real lighting, to keep the
    // focus on the camera.
    outColor = vec4(u_color * v_shade, 1.0);
  }
`;

// The unit cube: 6 faces x 2 triangles x 3 vertices = 36 vertices.
const cubePositions = new Float32Array([
  -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,   // front (z = +0.5)
  -0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
   0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   // back (z = -0.5)
   0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,
  -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,   // top (y = +0.5)
  -0.5,  0.5,  0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5,
  -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,   // bottom (y = -0.5)
  -0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5,
   0.5, -0.5,  0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   // right (x = +0.5)
   0.5, -0.5,  0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,
  -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,   // left (x = -0.5)
  -0.5, -0.5, -0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5,
]);
const cubeShades = new Float32Array([
  0.85, 0.85, 0.85, 0.85, 0.85, 0.85,   // front
  0.70, 0.70, 0.70, 0.70, 0.70, 0.70,   // back
  1.00, 1.00, 1.00, 1.00, 1.00, 1.00,   // top
  0.40, 0.40, 0.40, 0.40, 0.40, 0.40,   // bottom
  0.75, 0.75, 0.75, 0.75, 0.75, 0.75,   // right
  0.60, 0.60, 0.60, 0.60, 0.60, 0.60,   // left
]);
const VERTEX_COUNT = 36;

// The scene from camera-move, recolored: red, green and blue are kept for
// the camera axes, so no box can be mistaken for an axis.
const sceneObjects = [
  { position: [ 0.0, -0.05,  0.0], size: [8.0, 0.1, 8.0], color: [0.55, 0.55, 0.55] },  // floor
  { position: [ 0.0,  1.0,   0.0], size: [1.0, 2.0, 1.0], color: [0.95, 0.55, 0.15] },  // tower (orange)
  { position: [ 2.0,  0.5,   1.0], size: [1.0, 1.0, 1.0], color: [0.60, 0.42, 0.85] },  // purple box
  { position: [-2.0,  0.35,  1.5], size: [0.7, 0.7, 0.7], color: [0.20, 0.70, 0.70] },  // teal box
  { position: [-1.0,  0.25, -2.0], size: [1.5, 0.5, 0.8], color: [0.95, 0.85, 0.25] },  // yellow box
];
for (const object of sceneObjects) {
  object.model = makeModelMatrix(object.position, object.size);
}

// Background of both 3D views (the same color as .view-wrap in the CSS).
const BACKGROUND = [0.10, 0.12, 0.16];

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error('Shader did not compile: ' + gl.getShaderInfoLog(shader));
  }
  return shader;
}

// Set up one canvas: context, program, cube buffers. Returns what the
// drawing code needs, or null if the browser has no WebGL 2.
function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2');
  if (!gl) return null;

  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Program did not link: ' + gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  // Upload the cube once and connect it to the two attributes.
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, cubePositions, gl.STATIC_DRAW);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(positionLocation);

  const shadeLocation = gl.getAttribLocation(program, 'a_shade');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, cubeShades, gl.STATIC_DRAW);
  gl.vertexAttribPointer(shadeLocation, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shadeLocation);

  gl.enable(gl.DEPTH_TEST);

  return {
    gl, canvas,
    modelLocation:      gl.getUniformLocation(program, 'u_model'),
    viewLocation:       gl.getUniformLocation(program, 'u_view'),
    projectionLocation: gl.getUniformLocation(program, 'u_projection'),
    colorLocation:      gl.getUniformLocation(program, 'u_color'),
  };
}

// Make a canvas's drawing buffer match its size on screen, times the
// device pixel ratio, so it is sharp on high-DPI screens.
function sizeCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

// Clear the canvas. If `view` and `projection` are given, draw every
// object in `objects` with them.
function drawBoxes(renderer, view, projection, objects) {
  const gl = renderer.gl;
  sizeCanvas(renderer.canvas);
  gl.viewport(0, 0, renderer.canvas.width, renderer.canvas.height);
  gl.clearColor(BACKGROUND[0], BACKGROUND[1], BACKGROUND[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (!view) return;

  gl.uniformMatrix4fv(renderer.viewLocation, false, view);
  gl.uniformMatrix4fv(renderer.projectionLocation, false, projection);
  for (const object of objects) {
    gl.uniformMatrix4fv(renderer.modelLocation, false, object.model);
    gl.uniform3fv(renderer.colorLocation, object.color);
    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
  }
}


// -----------------------------------------------------------------------------
// Section 5. Drawing the camera view.
// -----------------------------------------------------------------------------
// This is exactly what a WebGL program would draw with the code shown in the
// code panel. If the camera can't be built, the view says why instead.

const cameraCanvas = document.getElementById('camera-gl');
const cameraMessage = document.getElementById('camera-message');
const cameraRenderer = createRenderer(cameraCanvas);

// The lens settings, worked out from the state. `canvasAspect` is the
// camera view's real width / height; `aspect` is what is passed to
// perspective (the same, unless a wrong value was chosen).
function lensSettings() {
  const canvasAspect = cameraCanvas.clientWidth / Math.max(1, cameraCanvas.clientHeight);
  const lens = {
    fovRad: state.fovDeg * Math.PI / 180,
    canvasAspect,
    aspect: state.aspect === 'canvas' ? canvasAspect : Number(state.aspect),
    near: state.near,
    far: state.far,
    ok: state.near < state.far,
  };
  return lens;
}

// Words for each reason the camera can't be built (used by the camera
// view, the check box and the code panel).
const PROBLEM_TEXT = {
  'eye-is-target': 'The eye and the target are the same point, so there is no view direction.',
  'zero-up': 'The up vector is the zero vector, so it gives no direction.',
  'up-parallel': 'The up vector is parallel to the view direction, so cross(up, zAxis) is ' +
                 'the zero vector and cannot be normalized. lookAt cannot build the x axis.',
  'near-far': 'The near plane must be closer than the far plane (near < far).',
};

function drawCameraView(cam, lens) {
  if (!cameraRenderer) return;
  let problem = null;
  if (!cam.ok) problem = PROBLEM_TEXT[cam.problem];
  else if (!lens.ok) problem = PROBLEM_TEXT['near-far'];

  if (problem) {
    drawBoxes(cameraRenderer, null);
    cameraMessage.textContent = problem;
    cameraMessage.style.display = 'flex';
    return;
  }
  cameraMessage.style.display = 'none';
  const view = lookAt(state.eye, state.target, state.up);
  const projection = perspective(lens.fovRad, lens.aspect, lens.near, lens.far);
  drawBoxes(cameraRenderer, view, projection, sceneObjects);
}


// -----------------------------------------------------------------------------
// Section 6. Drawing the world view.
// -----------------------------------------------------------------------------
// The world view looks at the scene from a second viewpoint, outside the
// camera, set by the "world view" sliders. It uses the same lookAt and
// perspective. WebGL draws the boxes and the camera's body; a 2D canvas on
// top draws the lines, arrows and labels (so they can be thick, dashed, and
// never hidden behind a box).

const worldCanvas = document.getElementById('world-gl');
const overlay = document.getElementById('world-overlay');
const overlayContext = overlay.getContext('2d');
const worldRenderer = createRenderer(worldCanvas);

// Colors for the overlay (the 3D views always have a dark background).
const COLORS = {
  x: '#ff5a5a', y: '#4cd964', z: '#4da3ff',
  up: '#f2f2f2', viewDirection: '#f2c14e',
  frustum: 'rgba(210, 210, 210, 0.85)', nearFill: 'rgba(210, 210, 210, 0.12)',
  worldAxes: '#9aa0a6', label: '#f2f2f2', glow: '#ffd84d',
};
const AXIS_LENGTH = 1.6;      // length of the camera's axis arrows
const UP_ARROW_LENGTH = 1.6;  // the up arrow is this times the up vector

// The world view's own view and projection matrices. It orbits a point
// between the scene and the camera's starting position, so both fit.
const WORLD_VIEW_TARGET = [3, 1.5, 0];
function worldViewMatrices() {
  const angle = state.world.angleDeg * Math.PI / 180;
  const worldEye = add(WORLD_VIEW_TARGET, [state.world.distance * Math.cos(angle), state.world.height,
                                           state.world.distance * Math.sin(angle)]);
  return {
    view: lookAt(worldEye, WORLD_VIEW_TARGET, [0, 1, 0]),
    projection: perspective(45 * Math.PI / 180,
                            worldCanvas.clientWidth / Math.max(1, worldCanvas.clientHeight), 0.1, 300),
  };
}

// --- Turning world points into overlay pixels ---
// A point goes world -> camera space (of the world view) -> clip space ->
// divide by w -> pixels. Points behind the world view's eye can't be
// projected, so line segments are first cut at z = -0.1 in camera space.
const OVERLAY_NEAR = -0.1;

function cameraSpaceToPixels(world, c) {
  const clip = transformPoint(world.projection, c);
  const w = clip[3];
  return [(clip[0] / w + 1) / 2 * overlay.clientWidth,
          (1 - clip[1] / w) / 2 * overlay.clientHeight];
}

function projectPoint(world, p) {
  const c = transformPoint(world.view, p);
  if (c[2] > OVERLAY_NEAR) return null;   // behind the world view's eye
  return cameraSpaceToPixels(world, c);
}

function projectSegment(world, a, b) {
  let ca = transformPoint(world.view, a);
  let cb = transformPoint(world.view, b);
  if (ca[2] > OVERLAY_NEAR && cb[2] > OVERLAY_NEAR) return null;
  // Cut the part of the segment that is behind the world view's eye.
  const cut = (p, q) => {
    const t = (OVERLAY_NEAR - p[2]) / (q[2] - p[2]);
    return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]), OVERLAY_NEAR, 1];
  };
  if (ca[2] > OVERLAY_NEAR) ca = cut(ca, cb);
  else if (cb[2] > OVERLAY_NEAR) cb = cut(cb, ca);
  return [cameraSpaceToPixels(world, ca), cameraSpaceToPixels(world, cb)];
}

// --- Drawing helpers for the overlay ---
// `lit` draws the thing with a yellow glow (linked highlighting).
function setStroke(color, width, dashed, lit) {
  const ctx = overlayContext;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lit ? width + 1.5 : width;
  ctx.setLineDash(dashed ? [6, 5] : []);
  ctx.shadowColor = COLORS.glow;
  ctx.shadowBlur = lit ? 12 : 0;
}

function line3D(world, a, b, color, width, dashed, lit) {
  const s = projectSegment(world, a, b);
  if (!s) return;
  setStroke(color, width, dashed, lit);
  overlayContext.beginPath();
  overlayContext.moveTo(s[0][0], s[0][1]);
  overlayContext.lineTo(s[1][0], s[1][1]);
  overlayContext.stroke();
}

function arrow3D(world, from, to, color, width, label, lit) {
  const s = projectSegment(world, from, to);
  if (!s) return;
  const [a, b] = s;
  setStroke(color, width, false, lit);
  const ctx = overlayContext;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  // Arrowhead, drawn in pixels along the projected direction.
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len > 4) {
    const ux = dx / len, uy = dy / len, head = 9;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(b[0] - head * ux - head * 0.5 * uy, b[1] - head * uy + head * 0.5 * ux);
    ctx.lineTo(b[0] - head * ux + head * 0.5 * uy, b[1] - head * uy - head * 0.5 * ux);
    ctx.closePath();
    ctx.fill();
  }
  if (label) text2D(b, label, color, dx, dy);
}

// A label just past the point `p`, pushed in the direction (dx, dy).
function text2D(p, label, color, dx = 0, dy = -1) {
  const len = Math.hypot(dx, dy) || 1;
  const ctx = overlayContext;
  ctx.shadowBlur = 0;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, p[0] + 12 * dx / len, p[1] + 12 * dy / len);
}

function dot3D(world, p, color, radius, label, lit) {
  const q = projectPoint(world, p);
  if (!q) return;
  setStroke(color, 2, false, lit);
  overlayContext.beginPath();
  overlayContext.arc(q[0], q[1], lit ? radius + 1.5 : radius, 0, 2 * Math.PI);
  overlayContext.fill();
  if (label) text2D(q, label, color, 0, -1);
}

// The 4 corners of the frustum's cross-section at distance d in front of
// the eye, in world coordinates. The field of view is vertical, so the
// half-height is d * tan(fov / 2), and the half-width is that times aspect.
function frustumCorners(cam, lens, d) {
  const halfHeight = d * Math.tan(lens.fovRad / 2);
  const halfWidth = halfHeight * lens.aspect;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) =>
    cameraToWorld(cam, state.eye, sx * halfWidth, sy * halfHeight, -d));
}

function drawWorldView(cam, lens) {
  if (!worldRenderer) return;
  const world = worldViewMatrices();
  const lit = (name) => state.highlight === name;
  const lensLit = lit('fov') || lit('aspect') || lit('proj');

  // 1. WebGL: the scene, plus the camera's body when the camera is valid.
  //    The body is a small box just behind the eye, turned to match the
  //    camera's axes: its model matrix is the camera's placement matrix
  //    (the inverse of the view matrix) times a scale.
  const objects = sceneObjects.slice();
  if (cam.ok) {
    objects.push({
      model: multiply(cameraPlacement(cam, state.eye),
                      makeModelMatrix([0, 0, 0.35], [0.55, 0.4, 0.6])),
      color: [0.85, 0.86, 0.9],
    });
  }
  drawBoxes(worldRenderer, world.view, world.projection, objects);

  // 2. The overlay.
  sizeCanvas(overlay);
  const ratio = overlay.width / Math.max(1, overlay.clientWidth);
  const ctx = overlayContext;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, overlay.clientWidth, overlay.clientHeight);
  ctx.lineCap = 'round';

  // World axes at the origin (gray), to compare with the camera's axes.
  const origin = [0, 0.02, 0];
  arrow3D(world, origin, [2.5, 0.02, 0], COLORS.worldAxes, 1.5, 'X', false);
  arrow3D(world, origin, [0, 2.5, 0], COLORS.worldAxes, 1.5, 'Y', false);
  arrow3D(world, origin, [0, 0.02, 2.5], COLORS.worldAxes, 1.5, 'Z', false);

  if (cam.ok && lens.ok) {
    // The view frustum: the near rectangle, the far rectangle, and the four
    // edges from the eye through the corners.
    const nearCorners = frustumCorners(cam, lens, lens.near);
    const farCorners = frustumCorners(cam, lens, lens.far);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      line3D(world, state.eye, nearCorners[i], COLORS.frustum, 1, true, lensLit);
      line3D(world, nearCorners[i], farCorners[i], COLORS.frustum, 1.2, false, lensLit);
      line3D(world, nearCorners[i], nearCorners[j], COLORS.frustum, 1.5, false, lensLit || lit('near'));
      line3D(world, farCorners[i], farCorners[j], COLORS.frustum, 1.5, false, lensLit || lit('far'));
    }
    // Shade the near plane a little, so it is easy to find.
    const pts = nearCorners.map((p) => projectPoint(world, p));
    if (pts.every((p) => p)) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.nearFill;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
    }
  }

  // The view direction: a dashed line from the eye to the target.
  if (cam.zAxis) {
    line3D(world, state.eye, state.target, COLORS.viewDirection, 1.5, true, lit('target'));
  }
  dot3D(world, state.target, COLORS.viewDirection, 4, 'target', lit('target'));

  // The camera's axes.
  if (cam.ok) {
    const axesLit = lit('view');
    arrow3D(world, state.eye, add(state.eye, scale(cam.xAxis, AXIS_LENGTH)), COLORS.x, 3, 'x', axesLit);
    arrow3D(world, state.eye, add(state.eye, scale(cam.yAxis, AXIS_LENGTH)), COLORS.y, 3, 'y', axesLit);
    arrow3D(world, state.eye, add(state.eye, scale(cam.zAxis, AXIS_LENGTH)), COLORS.z, 3, 'z', axesLit);
  }

  // The up vector, with its real direction and length (it is usually not
  // the same as the camera's y axis).
  if (length(state.up) > TINY) {
    arrow3D(world, state.eye, add(state.eye, scale(state.up, UP_ARROW_LENGTH)),
            COLORS.up, 1.5, 'up', lit('up'));
  }

  dot3D(world, state.eye, COLORS.label, 4, null, lit('eye'));
  const eyePixel = projectPoint(world, state.eye);
  if (eyePixel) text2D([eyePixel[0] - 6, eyePixel[1] + 16], 'eye', COLORS.label, 0, 0);
  ctx.shadowBlur = 0;
}


// -----------------------------------------------------------------------------
// Section 7. The code panel and the definition panel.
// -----------------------------------------------------------------------------
// The CODE PANEL shows only the program's own lines that set up the camera,
// with the current numbers. It is rebuilt as HTML after every change: one
// <div class="line"> per line. A line that belongs to a slider has
// data-link, for the linked highlighting. Every number is a <span
// class="num">; a number whose text changed since the last update gets the
// class "changed", which lights it up for a moment (see the CSS).
//
// The function names lookAt, perspective and uniformMatrix4fv are links.
// Clicking one opens the DEFINITION PANEL beside the code:
//   - lookAt and perspective: the whole function, word for word as in the
//     camera-move example, with the current values in a separate column
//     (so the values can't be mistaken for code);
//   - uniformMatrix4fv: a WebGL function, not ours, so instead of a
//     definition the panel shows the 16 floats the call sends.

const codePanel = document.getElementById('code');
const detailPanel = document.getElementById('detail');
let previousNumbers = {};   // key -> text, from the last update
let currentNumbers = {};

// Format a number: fixed digits, and no "-0.00".
function fmt(value, digits = 2) {
  if (Math.abs(value) < 0.5 * Math.pow(10, -digits)) value = 0;
  return value.toFixed(digits);
}

// A number on the page. `key` names it, so we can tell when it changed.
function num(key, value, digits = 2, cls = '') {
  const text = Number.isFinite(value) ? fmt(value, digits) : '—';
  currentNumbers[key] = text;
  const changed = key in previousNumbers && previousNumbers[key] !== text;
  return `<span class="num ${cls}${changed ? ' changed' : ''}">${text}</span>`;
}

// A list of numbers in brackets. `classes[i]` colors number i.
function vec(key, v, digits = 2, classes = []) {
  return '[ ' + Array.from(v, (c, i) => num(key + i, c, digits, classes[i] || '')).join(', ') + ' ]';
}

const comment = (text) => `<span class="comment">${text}</span>`;

// A function name that opens the definition panel.
function fnLink(name, detail) {
  const open = state.detail === detail ? ' open' : '';
  return `<span class="fn${open}" data-detail="${detail}" title="Click to see how ${name} works">${name}</span>`;
}

// One line of the program. Options: link (for highlighting), bad (red).
function codeLine(html, options = {}) {
  const classes = ['line'];
  if (options.bad) classes.push('bad');
  if (options.link && options.link === state.highlight) classes.push('hl');
  const link = options.link ? ` data-link="${options.link}"` : '';
  return `<div class="${classes.join(' ')}"${link}>${html || ' '}</div>`;
}

function renderCode(cam, lens) {
  const L = [];   // the lines, as HTML

  // --- Part 1: the view matrix ---
  L.push(codeLine(comment('// 1. Where the camera is and how it\'s aimed')));
  L.push(codeLine(`const eye    = ${vec('eye', state.eye)};`, { link: 'eye' }));
  L.push(codeLine(`const target = ${vec('target', state.target)};`, { link: 'target' }));
  L.push(codeLine(`const up     = ${vec('up', state.up)};`, { link: 'up' }));
  L.push(codeLine(`const viewMatrix = ${fnLink('lookAt', 'lookAt')}(eye, target, up);` +
                  (cam.ok ? '' : '   ' + comment('// ✗ can\'t be built')),
                  { link: 'view', bad: !cam.ok }));
  L.push(codeLine(''));

  // --- Part 2: the projection matrix ---
  L.push(codeLine(comment('// 2. The lens')));
  L.push(codeLine(`const fieldOfView = ${num('fov', state.fovDeg, 0)} * Math.PI / 180;            ${comment('// vertical, in radians')}`,
                  { link: 'fov' }));
  if (state.aspect === 'canvas') {
    L.push(codeLine(`const aspect      = canvas.width / canvas.height;  ${comment('// = ')}${num('aspect', lens.aspect, 2, 'comment')}`,
                    { link: 'aspect' }));
  } else {
    L.push(codeLine(`const aspect      = ${num('aspect', lens.aspect, 2)};   ${comment(`// the canvas is ${fmt(lens.canvasAspect)}, so the picture is stretched`)}`,
                    { link: 'aspect', bad: true }));
  }
  L.push(codeLine(`const near = ${num('near', state.near, 1)};`, { link: 'near' }));
  L.push(codeLine(`const far  = ${num('far', state.far, 1)};`, { link: 'far' }));
  L.push(codeLine(`const projectionMatrix = ${fnLink('perspective', 'perspective')}(fieldOfView, aspect, near, far);` +
                  (lens.ok ? '' : '   ' + comment('// ✗ near must be less than far')),
                  { link: 'proj', bad: !lens.ok }));
  L.push(codeLine(''));

  // --- Part 3: sending the matrices to the shader ---
  L.push(codeLine(comment('// 3. Send both matrices to the vertex shader, which computes')));
  L.push(codeLine(comment('//    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);')));
  L.push(codeLine(`gl.${fnLink('uniformMatrix4fv', 'sendView')}(viewLocation,       false, viewMatrix);`,
                  { link: 'view' }));
  L.push(codeLine(`gl.${fnLink('uniformMatrix4fv', 'sendProj')}(projectionLocation, false, projectionMatrix);`,
                  { link: 'proj' }));

  codePanel.innerHTML = L.join('');
}

// --- The definition panel ---

// A value chip: a name and its value, styled as a value, not as code.
function chip(label, valueHtml, cls = '') {
  return `<span class="chip ${cls}">${label ? `<span class="chip-name">${label}</span> ` : ''}${valueHtml}</span>`;
}

// One row of a definition: a line of code, and the values next to it.
function defRow(code, values = '', options = {}) {
  const classes = ['def-row'];
  if (options.bad) classes.push('bad');
  if (options.link && options.link === state.highlight) classes.push('hl');
  const link = options.link ? ` data-link="${options.link}"` : '';
  return `<div class="${classes.join(' ')}"${link}><div class="def-code">${code || ' '}</div>` +
         `<div class="def-val">${values}</div></div>`;
}

const AXIS_CLASSES = ['ax-x', 'ax-y', 'ax-z', ''];   // row colors of the view matrix
const notComputed = chip('', 'not computed', 'muted');

function lookAtDefinition(cam) {
  const R = [];
  const o = { link: 'view' };
  // (eye, target and up are already shown in the code on the left.)
  R.push(defRow('function lookAt(eye, target, up) {'));

  if (cam.problem === 'eye-is-target') {
    R.push(defRow('  const zAxis = normalize(subtract(eye, target));',
                  chip('', 'subtract(eye, target) = [ 0, 0, 0 ]: no direction, can\'t normalize', 'bad'), { ...o, bad: true }));
  } else {
    R.push(defRow('  const zAxis = normalize(subtract(eye, target));',
                  chip('zAxis', vec('d-z', cam.zAxis), 'ax-z'), o));
  }
  if (cam.ok) {
    R.push(defRow('  const xAxis = normalize(cross(up, zAxis));',
                  chip('xAxis', vec('d-x', cam.xAxis), 'ax-x'), o));
    R.push(defRow(`  const yAxis = cross(zAxis, xAxis);   ${comment('// already length 1')}`,
                  chip('yAxis', vec('d-y', cam.yAxis), 'ax-y'), o));
  } else if (cam.problem === 'eye-is-target') {
    R.push(defRow('  const xAxis = normalize(cross(up, zAxis));', notComputed, o));
    R.push(defRow(`  const yAxis = cross(zAxis, xAxis);   ${comment('// already length 1')}`, notComputed, o));
  } else {
    R.push(defRow('  const xAxis = normalize(cross(up, zAxis));',
                  chip('', 'cross(up, zAxis) = [ 0, 0, 0 ]: can\'t normalize', 'bad'), { ...o, bad: true }));
    R.push(defRow(`  const yAxis = cross(zAxis, xAxis);   ${comment('// already length 1')}`, notComputed, o));
  }

  R.push(defRow(''));
  // camera-move's comment, with the same words on shorter lines so the
  // values column fits beside it.
  R.push(defRow(comment('  // The upper-left 3x3 part ROTATES world directions')));
  R.push(defRow(comment('  // into camera directions (the camera axes are the')));
  R.push(defRow(comment('  // ROWS). The last column TRANSLATES so that the eye')));
  R.push(defRow(comment('  // point lands exactly on the origin.')));
  R.push(defRow('  return new Float32Array(['));
  const columnCode = [
    `    xAxis[0], yAxis[0], zAxis[0], 0,   ${comment('// column 1')}`,
    `    xAxis[1], yAxis[1], zAxis[1], 0,   ${comment('// column 2')}`,
    `    xAxis[2], yAxis[2], zAxis[2], 0,   ${comment('// column 3')}`,
    `    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,   ${comment('// column 4')}`,
  ];
  const view = cam.ok ? lookAt(state.eye, state.target, state.up) : null;
  columnCode.forEach((code, col) => {
    R.push(defRow(code, view ? chip('', vec('d-v' + col, view.subarray(col * 4, col * 4 + 4), 2, AXIS_CLASSES)) : notComputed, o));
  });
  R.push(defRow('  ]);'));
  R.push(defRow('}'));

  return {
    title: 'Definition of <code>lookAt</code>',
    where: 'A helper function written by hand in the program\'s matrix helpers ' +
           '(Step 6 of the camera-move example). The line on the left calls it; ' +
           'its lines run each time it is called.',
    body: `<div class="def">${R.join('')}</div>`,
    note: cam.ok
      ? 'The values are for the current sliders. In the returned numbers, the x axis is red, ' +
        'the y axis green and the z axis blue: each axis is spread across the four columns, ' +
        'so it is a ROW of the matrix.'
      : '<span class="bad-text">' + PROBLEM_TEXT[cam.problem] + '</span>',
  };
}

function perspectiveDefinition(lens) {
  const R = [];
  const o = { link: 'proj' };
  const f = 1 / Math.tan(lens.fovRad / 2);
  const rangeInv = 1 / (lens.near - lens.far);
  // Only fieldOfView gets a chip: the code on the left shows it in degrees.
  R.push(defRow('function perspective(fieldOfView, aspect, near, far) {',
    chip('fieldOfView', `${num('d-fov', lens.fovRad, 3)} (radians)`)));
  R.push(defRow('  const f = 1.0 / Math.tan(fieldOfView / 2);', chip('f', num('d-f', f)), o));
  R.push(defRow('  const rangeInv = 1.0 / (near - far);', chip('rangeInv', num('d-rangeInv', rangeInv, 4)),
                { ...o, bad: !lens.ok }));
  R.push(defRow('  return new Float32Array(['));
  const columnCode = [
    `    f / aspect, 0, 0,                          0,    ${comment('// column 1')}`,
    `    0,          f, 0,                          0,    ${comment('// column 2')}`,
    `    0,          0, (near + far) * rangeInv,   -1,    ${comment('// column 3')}`,
    `    0,          0, 2 * near * far * rangeInv,  0,    ${comment('// column 4')}`,
  ];
  const projection = perspective(lens.fovRad, lens.aspect, lens.near, lens.far);
  columnCode.forEach((code, col) => {
    R.push(defRow(code, chip('', vec('d-p' + col, projection.subarray(col * 4, col * 4 + 4))), o));
  });
  R.push(defRow('  ]);'));
  R.push(defRow('}'));

  return {
    title: 'Definition of <code>perspective</code>',
    where: 'A helper function written by hand in the program\'s matrix helpers ' +
           '(Step 6 of the camera-move example). The line on the left calls it; ' +
           'its lines run each time it is called.',
    body: `<div class="def">${R.join('')}</div>`,
    note: (lens.ok ? '' : '<span class="bad-text">' + PROBLEM_TEXT['near-far'] + '</span> ') +
      `The field of view is vertical: y is scaled by f = ${fmt(f)}. x is scaled by ` +
      `f / aspect = ${fmt(f / lens.aspect)}, so the horizontal view fits the canvas's shape. ` +
      'A smaller field of view gives a bigger f, so things look bigger.',
  };
}

// The 16 floats a uniformMatrix4fv call sends: column by column, then laid
// out as a matrix. `rowClasses` colors the rows; `rowNotes` explains them.
function sendPanel(prefix, m, link, rowClasses, rowNotes) {
  const R = [];
  R.push('<p class="detail-sub">In the order they are sent: column by column (column-major).</p>');
  R.push('<div class="def">');
  for (let col = 0; col < 4; col++) {
    R.push(defRow(`column ${col + 1}`, chip('', vec(`${prefix}c${col}`, m.subarray(col * 4, col * 4 + 4), 2, rowClasses)), { link }));
  }
  R.push('</div>');
  R.push('<p class="detail-sub">The same numbers laid out as a matrix. The first column above is the first column here.</p>');
  R.push('<table class="matrix">');
  for (let row = 0; row < 4; row++) {
    const cells = [0, 1, 2, 3].map((col) =>
      `<td>${num(`${prefix}m${col}${row}`, m[col * 4 + row], 2, rowClasses[row])}</td>`).join('');
    R.push(`<tr>${cells}<th>${rowNotes[row]}</th></tr>`);
  }
  R.push('</table>');
  return R.join('');
}

function sendDefinition(which, cam, lens) {
  const isView = which === 'sendView';
  const name = isView ? 'viewMatrix' : 'projectionMatrix';
  const panel = {
    title: `What <code>gl.uniformMatrix4fv</code> sends: <code>${name}</code>`,
    where: 'uniformMatrix4fv is a WebGL function, not one of ours, so there is no ' +
           'definition to show. It copies 16 floats into a uniform of the shader ' +
           `(here ${isView ? 'u_view' : 'u_projection'}).`,
    note: '',
  };
  if (isView && !cam.ok) {
    panel.body = '<p class="bad-text">viewMatrix couldn\'t be built, so there is nothing useful to send.</p>';
  } else if (!isView && !lens.ok) {
    panel.body = '<p class="bad-text">projectionMatrix isn\'t usable: the near plane must be closer than the far plane.</p>';
  } else if (isView) {
    panel.body = sendPanel('s-v', lookAt(state.eye, state.target, state.up), 'view', AXIS_CLASSES,
      ['row 1: xAxis, then −dot(xAxis, eye)', 'row 2: yAxis, then −dot(yAxis, eye)',
       'row 3: zAxis, then −dot(zAxis, eye)', 'row 4: 0, 0, 0, 1']);
  } else {
    panel.body = sendPanel('s-p', perspective(lens.fovRad, lens.aspect, lens.near, lens.far), 'proj', ['', '', '', ''],
      ['row 1: scales x by f / aspect', 'row 2: scales y by f',
       'row 3: after the divide by w, z runs from −1 at the near plane to +1 at the far plane',
       'row 4: w = −z, the distance in front of the camera']);
  }
  return panel;
}

function renderDetail(cam, lens) {
  if (!state.detail) {
    detailPanel.hidden = true;
    detailPanel.innerHTML = '';
    return;
  }
  const panel = state.detail === 'lookAt' ? lookAtDefinition(cam)
              : state.detail === 'perspective' ? perspectiveDefinition(lens)
              : sendDefinition(state.detail, cam, lens);
  detailPanel.hidden = false;
  detailPanel.innerHTML =
    `<div class="detail-head"><h3>${panel.title}</h3>` +
    '<button type="button" class="close" data-close title="Close">✕</button></div>' +
    `<p class="detail-where">${panel.where}</p>${panel.body}` +
    (panel.note ? `<p class="detail-note">${panel.note}</p>` : '');
}

// The line under the code: where the target ends up in camera space.
const targetLine = document.getElementById('target-camera');
function renderTargetLine(cam) {
  if (!cam.ok) {
    targetLine.textContent = '';
    return;
  }
  const c = transformPoint(lookAt(state.eye, state.target, state.up), state.target);
  const distance = length(cam.eyeMinusTarget);
  targetLine.innerHTML =
    `The target in camera space: <code>viewMatrix × target = (${fmt(c[0])}, ${fmt(c[1])}, ${fmt(c[2])})</code>. ` +
    `It is always on the camera's −z axis, at the distance from the eye to the target (${fmt(distance)}).`;
}


// -----------------------------------------------------------------------------
// Section 8. Controls, linked highlighting, and update().
// -----------------------------------------------------------------------------

// Which sliders light up for a highlighted code line. A slider row lights
// up when its own link is highlighted, or when it is one of the arguments
// of a highlighted call.
const ARGUMENTS_OF = {
  view: ['eye', 'target', 'up'],
  proj: ['fov', 'aspect', 'near', 'far'],
};

function setHighlight(link) {
  if (state.highlight === link) return;
  state.highlight = link;
  update();
}

// Build the sliders into their fieldsets.
for (const slider of SLIDERS) {
  const row = document.createElement('div');
  row.className = 'slider-row';
  if (slider.link) row.dataset.link = slider.link;
  const id = `slider-${slider.group}-${slider.label.replace(/ /g, '-')}`;
  row.innerHTML = `<label for="${id}">${slider.label}</label>` +
    `<input type="range" id="${id}" min="${slider.min}" max="${slider.max}" step="${slider.step}">` +
    '<span class="value"></span>';
  document.getElementById('sliders-' + slider.group).appendChild(row);
  slider.input = row.querySelector('input');
  slider.output = row.querySelector('.value');
  slider.input.addEventListener('input', () => {
    slider.set(Number(slider.input.value));
    if (slider.link) state.highlight = slider.link;
    update();
  });
}

// Put the state's values into the sliders (after a preset is chosen).
function syncSliders() {
  for (const slider of SLIDERS) {
    slider.input.value = slider.get();
  }
  aspectSelect.value = state.aspect;
}

// The preset menu.
const presetSelect = document.getElementById('preset');
const presetNote = document.getElementById('preset-note');
PRESETS.forEach((preset, i) => presetSelect.add(new Option(`${i + 1}. ${preset.name}`, i)));
presetSelect.addEventListener('change', () => {
  const preset = PRESETS[presetSelect.value];
  applyPreset(preset);
  presetNote.textContent = preset.note;
  syncSliders();
  update();
});

// The aspect ratio menu.
const aspectSelect = document.getElementById('aspect');
aspectSelect.addEventListener('change', () => {
  state.aspect = aspectSelect.value;
  state.highlight = 'aspect';
  update();
});

// Hovering a slider row (or a code line) lights up everything with the
// same link. While a slider is being dragged the pointer may leave its
// row, so the highlight is only cleared when no button is pressed.
const panel = document.getElementById('panel');
panel.addEventListener('pointerover', (e) => {
  const row = e.target.closest('[data-link]');
  if (row) setHighlight(row.dataset.link);
});
panel.addEventListener('pointerout', (e) => {
  if (e.buttons === 0 && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#panel [data-link]'))) {
    setHighlight(null);
  }
});
window.addEventListener('pointerup', (e) => {
  const row = e.target.closest && e.target.closest('[data-link]');
  setHighlight(row ? row.dataset.link : null);
});

codePanel.addEventListener('pointerover', (e) => {
  const line = e.target.closest('[data-link]');
  setHighlight(line ? line.dataset.link : null);
});
codePanel.addEventListener('pointerleave', () => setHighlight(null));

// Clicking a function name opens its definition panel; clicking it again,
// or the panel's ✕, closes it. On narrow screens the panel is below the
// code, so it is scrolled into view when it opens.
codePanel.addEventListener('click', (e) => {
  const link = e.target.closest('[data-detail]');
  if (!link) return;
  const name = link.dataset.detail;
  state.detail = state.detail === name ? null : name;
  update();
  if (state.detail) detailPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
detailPanel.addEventListener('click', (e) => {
  if (!e.target.closest('[data-close]')) return;
  state.detail = null;
  update();
});
detailPanel.addEventListener('pointerover', (e) => {
  const row = e.target.closest('[data-link]');
  setHighlight(row ? row.dataset.link : null);
});
detailPanel.addEventListener('pointerleave', () => setHighlight(null));

// The "camera check" box in the side panel.
const checkBox = document.getElementById('check');
function renderCheck(cam, lens) {
  let kind, html;
  if (!cam.ok) {
    kind = 'bad';
    html = '<b>The camera can\'t be built.</b> ' + PROBLEM_TEXT[cam.problem];
  } else if (!lens.ok) {
    kind = 'bad';
    html = '<b>The lens can\'t be built.</b> ' + PROBLEM_TEXT['near-far'];
  } else if (cam.upAngleDeg < 5 || cam.upAngleDeg > 175) {
    kind = 'warn';
    html = `The up vector is almost parallel to the view direction (angle ${fmt(cam.upAngleDeg, 0)}°). ` +
           'The camera still works, but a small change to up makes it roll a lot.';
  } else {
    kind = 'ok';
    html = `Angle between the up vector and the view direction: <b>${fmt(cam.upAngleDeg, 0)}°</b>. ` +
           'Any angle works except 0° and 180° (parallel).';
  }
  checkBox.className = kind;
  checkBox.innerHTML = html;
}

// Light up the slider rows that match the highlight.
function renderSliderHighlights() {
  const related = ARGUMENTS_OF[state.highlight] || [];
  for (const row of panel.querySelectorAll('[data-link]')) {
    const link = row.dataset.link;
    row.classList.toggle('hl', link === state.highlight || related.includes(link));
  }
}

// Redraw everything from the state.
function update() {
  for (const slider of SLIDERS) {
    slider.output.textContent = fmt(slider.get(), slider.digits) + (slider.unit || '');
  }
  const cam = checkCamera(state.eye, state.target, state.up);
  const lens = lensSettings();
  drawCameraView(cam, lens);
  drawWorldView(cam, lens);
  currentNumbers = {};
  renderCode(cam, lens);
  renderDetail(cam, lens);
  previousNumbers = currentNumbers;
  renderTargetLine(cam);
  renderCheck(cam, lens);
  renderSliderHighlights();
}

// Start with the first preset, and redraw whenever the views change size.
if (!cameraRenderer || !worldRenderer) {
  document.getElementById('main').insertAdjacentHTML('afterbegin',
    '<p class="bad">This browser does not support WebGL 2, so the 3D views are empty.</p>');
}
applyPreset(PRESETS[0]);
presetNote.textContent = PRESETS[0].note;
syncSliders();
new ResizeObserver(() => update()).observe(document.getElementById('main'));
update();
