// =============================================================================
// index.js — An interactive playground for gl_VertexID, flat outputs, and
// what the fragment shader can see of a vertex's number.
//
// THE BIG IDEA
// ------------
// A draw call runs the vertex shader once for every step k = 0, 1, 2, … of
// the draw. At each step it fetches one vertex from the vertex buffer, and
// the built-in input gl_VertexID tells the shader WHICH vertex that was:
//
//   drawArrays(mode, first, count):    gl_VertexID = first + k
//   drawElements(mode, count, …):      gl_VertexID = indices[k]
//
// With drawElements, gl_VertexID is the VALUE read from the index buffer,
// not the position k in the index list. Two steps that use the same index
// fetch the same vertex, so they see the same gl_VertexID and produce the
// same outputs.
//
// The fragment shader never sees gl_VertexID. It only receives the vertex
// shader's outputs ("varyings"), in one of two ways:
//   - interpolated (the default): each fragment gets λ0·v0 + λ1·v1 + λ2·v2,
//     where λ0, λ1, λ2 are its barycentric coordinates in the triangle;
//   - flat: no interpolation; every fragment of a triangle gets the value
//     of ONE vertex, the triangle's LAST vertex (the "provoking vertex").
//
// HOW THIS TOOL WORKS
// -------------------
// Every time a control changes, the tool does the same draw TWICE:
//   - with REAL WebGL 2 (section 5), compiling the exact shader source
//     shown on the page. Its picture and its errors are what a real
//     program would get.
//   - with a JAVASCRIPT COPY of the steps (section 3): which vertex each
//     step fetches, what the vertex shader outputs, and, for the fragment
//     you click, its barycentric coordinates and what it receives. The GPU
//     cannot show us these numbers, so the copy explains them; the
//     inspector then reads the real pixel back from WebGL to compare.
//
// FILE OUTLINE
//   Section 1. Colors and starting points (presets).
//   Section 2. The program state.
//   Section 3. The simulator: steps, vertex shader, and one fragment.
//   Section 4. The shaders: building the GLSL source for each choice.
//   Section 5. Real WebGL 2: buffers, the draw, and reading a pixel back.
//   Section 6. The memory picture (Canvas 2D).
//   Section 7. The result overlay and the fragment inspector.
//   Section 8. The other views: explanation, runs table, code listings.
//   Section 9. The side panel: controls, and update() which redraws it all.
// =============================================================================


// -----------------------------------------------------------------------------
// Section 1. Colors and starting points (presets).
// -----------------------------------------------------------------------------

// The 8 colors the shaders can look up by number. In the shader this is a
// uniform array, uPalette[8], so every vertex sees the same 8 colors.
const PALETTE = [
  { name: 'red',     rgb: [0.90, 0.15, 0.15] },
  { name: 'green',   rgb: [0.15, 0.70, 0.20] },
  { name: 'blue',    rgb: [0.15, 0.35, 0.90] },
  { name: 'yellow',  rgb: [0.95, 0.80, 0.10] },
  { name: 'magenta', rgb: [0.85, 0.20, 0.75] },
  { name: 'cyan',    rgb: [0.10, 0.75, 0.80] },
  { name: 'orange',  rgb: [0.95, 0.50, 0.10] },
  { name: 'purple',  rgb: [0.50, 0.25, 0.75] },
];

// The color the canvas is cleared to (the background).
const BACKGROUND = [0.97, 0.97, 0.97];

// Each vertex in the buffer is x, y, r, g, b: 5 floats = 20 bytes.
const FLOATS_PER_VERTEX = 5;
const BYTES_PER_FLOAT = 4;
const STRIDE = FLOATS_PER_VERTEX * BYTES_PER_FLOAT;   // 20 bytes
const LABELS = ['x', 'y', 'r', 'g', 'b'];

// The buffer's own colors (aColor) are a soft gradient made from the
// position, so they never look like the palette colors.
function vertex(x, y) {
  return [x, y, 0.35 + 0.5 * (x + 1) / 2, 0.35 + 0.5 * (y + 1) / 2, 0.75];
}

// Pick entries of a list in a given order (to repeat shared corners).
function pick(list, order) {
  return order.map(i => list[i]);
}

// A triangle, and a square made of two triangles. Positions are in clip
// space, where the visible area runs from -1 to 1 in x and y.
const TRIANGLE = [vertex(0, 0.7), vertex(-0.7, -0.5), vertex(0.7, -0.5)];
const SQUARE = [vertex(-0.6, -0.6), vertex(0.6, -0.6), vertex(0.6, 0.6), vertex(-0.6, 0.6)];
const SQUARE_TRIANGLES = [0, 1, 2, 0, 2, 3];

// A 2 × 2 grid of squares: 3 × 3 = 9 corners, numbered row by row from the
// bottom left (0 1 2 / 3 4 5 / 6 7 8), and 8 triangles.
const GRID = [];
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) GRID.push(vertex(-0.75 + 0.75 * col, -0.75 + 0.75 * row));
}
const GRID_TRIANGLES = [];
for (let row = 0; row < 2; row++) {
  for (let col = 0; col < 2; col++) {
    const a = row * 3 + col;       // bottom left corner of this square
    // Two triangles per square: bottom-left, bottom-right, top-right; and
    // bottom-left, top-right, top-left.
    GRID_TRIANGLES.push(a, a + 1, a + 4, a, a + 4, a + 3);
  }
}

// A hexagon made of 6 triangles around a center: vertex 0 is the center,
// vertices 1–6 go around the outside, and triangle i is 0, i, i+1.
const HEXAGON = [vertex(0, 0)];
for (let i = 0; i < 6; i++) {
  const angle = i * Math.PI / 3;
  HEXAGON.push(vertex(0.75 * Math.cos(angle), 0.75 * Math.sin(angle)));
}
const HEXAGON_TRIANGLES = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 1];

const PRESETS = [
  {
    name: '1. Triangle: gl_VertexID is 0, 1, 2',
    note: 'drawArrays(TRIANGLES, 0, 3) fetches vertices 0, 1, 2, so the ' +
      'vertex shader sees gl_VertexID = 0, then 1, then 2. Each vertex picks ' +
      'its palette color by that number, and the rasterizer interpolates ' +
      'the colors across the triangle.',
    vertices: TRIANGLE, indices: null,
    draw: { kind: 'arrays', first: 0, count: 3 }, vs: 'id', fs: 'smooth',
  },
  {
    name: '2. drawArrays with first = 3',
    note: 'The buffer holds the 6 vertices of a square, but the draw only ' +
      'uses the second triangle: first = 3, count = 3. gl_VertexID counts ' +
      'from first, so it is 3, 4, 5, not 0, 1, 2.',
    vertices: pick(SQUARE, SQUARE_TRIANGLES), indices: null,
    draw: { kind: 'arrays', first: 3, count: 3 }, vs: 'id', fs: 'smooth',
  },
  {
    name: '3. Square with drawArrays: one corner, two IDs',
    note: 'With drawArrays, a square needs 6 vertices, and two corners are ' +
      'stored twice. The copies are different vertices (0 and 3; 2 and 4), ' +
      'so they get different IDs and different colors at the same spot. ' +
      'Look at the diagonal.',
    vertices: pick(SQUARE, SQUARE_TRIANGLES), indices: null,
    draw: { kind: 'arrays', first: 0, count: 6 }, vs: 'id', fs: 'smooth',
  },
  {
    name: '4. Square indexed: gl_VertexID = the index value',
    note: 'Each corner is stored once. At step 3 the draw reads indices[3] = 0, ' +
      'so gl_VertexID is 0, not 3. Steps 0 and 3 fetch the same vertex and ' +
      'get the same color, so the diagonal has no seam.',
    vertices: SQUARE, indices: SQUARE_TRIANGLES,
    draw: { kind: 'elements', count: 6 }, vs: 'id', fs: 'smooth',
  },
  {
    name: '5. flat: the last vertex decides',
    note: 'The fragment shader uses flat, so each triangle gets the color of ' +
      'its last vertex. Both triangles here end on vertex 2 (indices 0 1 2 ' +
      'and 3 0 2), so the whole square is one color. Reorder the second ' +
      'triangle\'s indices so the two triangles get different colors.',
    vertices: SQUARE, indices: [0, 1, 2, 3, 0, 2],
    draw: { kind: 'elements', count: 6 }, vs: 'id', fs: 'flat',
  },
  {
    name: '6. Triangle number with drawArrays',
    note: 'WebGL 2 has no triangle number for the fragment shader. With ' +
      'drawArrays and TRIANGLES, vertices 0–2 are triangle 0, 3–5 are ' +
      'triangle 1, and so on, so gl_VertexID / 3 (integer division) is the ' +
      'triangle number. A flat output gives the whole triangle that value.',
    vertices: pick(GRID, GRID_TRIANGLES), indices: null,
    draw: { kind: 'arrays', first: 0, count: 24 }, vs: 'tri', fs: 'flat',
  },
  {
    name: '7. Triangle number with drawElements (broken)',
    note: 'The same grid, indexed: 9 vertices, 24 indices. Now gl_VertexID ' +
      'is a corner number (0–8), not a step number, so gl_VertexID / 3 is ' +
      'only 0, 1 or 2 (the row). Triangles that should differ get the same color.',
    vertices: GRID, indices: GRID_TRIANGLES,
    draw: { kind: 'elements', count: 24 }, vs: 'tri', fs: 'flat',
  },
  {
    name: '8. Wireframe with drawArrays',
    note: 'The vertex shader gives each triangle\'s 3 vertices red, green ' +
      'and blue: (1,0,0), (0,1,0), (0,0,1). Interpolated, these are the ' +
      'fragment\'s barycentric coordinates λ0, λ1, λ2, and one of them is 0 ' +
      'on each edge. The fragment shader draws a line there. Try the ' +
      'interpolated fragment shader too.',
    vertices: pick(GRID, GRID_TRIANGLES), indices: null,
    draw: { kind: 'arrays', first: 0, count: 24 }, vs: 'bary', fs: 'edges',
  },
  {
    name: '9. Wireframe with drawElements (broken)',
    note: 'The same trick on an indexed hexagon (center vertex 0, triangles ' +
      '0 1 2, 0 2 3, …). gl_VertexID % 3 now depends on the vertex number, and ' +
      'a shared vertex keeps one value in every triangle it is in. Triangles ' +
      '0 1 2 and 0 4 5 happen to get 3 different values and show their edges. ' +
      'The others get two vertices with the same value, so one component is 0 ' +
      'across the whole triangle, and every fragment counts as "on an edge".',
    vertices: HEXAGON, indices: HEXAGON_TRIANGLES,
    draw: { kind: 'elements', count: 18 }, vs: 'bary', fs: 'edges',
  },
];


// -----------------------------------------------------------------------------
// Section 2. The program state.
// -----------------------------------------------------------------------------
// Everything the views depend on lives in these variables. Every control
// changes them and then calls update() (section 9) to redo everything.

let presetIndex = 0;
let vertexData = null;   // Float32Array: x, y, r, g, b for each vertex
let indices = null;      // The index buffer's values (a plain array), or null.
let draw = {};           // { kind: 'arrays' | 'elements', first, count, elementCount }
let vsChoice = 'id';     // 'aColor' | 'id' | 'tri' | 'bary'
let fsChoice = 'smooth'; // 'smooth' | 'flat' | 'edges'
let step = 0;            // The selected step of the draw call.
let clicked = null;      // The point clicked on the result, in CSS pixels, or null.

// Results of the simulator (filled by update()).
let runs = [];           // runs[k]: what step k fetched and output
let triangles = [];      // groups of 3 steps that make a whole triangle

function vertexCount() {
  return vertexData.length / FLOATS_PER_VERTEX;
}

// Copy a preset into the state (copies, so editing never changes PRESETS).
function loadPreset(i) {
  const p = PRESETS[i];
  presetIndex = i;
  vertexData = new Float32Array(p.vertices.flat());
  indices = p.indices ? p.indices.slice() : null;
  draw = {
    kind: p.draw.kind,
    first: p.draw.first || 0,
    count: p.draw.kind === 'arrays' ? p.draw.count : vertexCount(),
    elementCount: p.draw.kind === 'elements' ? p.draw.count : (indices ? indices.length : 0),
  };
  vsChoice = p.vs;
  fsChoice = p.fs;
  step = 0;
  clicked = null;
}


// -----------------------------------------------------------------------------
// Section 3. The simulator: steps, vertex shader, and one fragment.
// -----------------------------------------------------------------------------
// A JavaScript copy of what WebGL does, so the tool can show the numbers.
// The real drawing is done by WebGL in section 5.

// The vertex number each step of the draw call fetches:
//   { vertex: the number (gl_VertexID), or null if there is none,
//     indexPosition: which entry of the index buffer it came from }
function drawSequence() {
  const seq = [];
  if (draw.kind === 'arrays') {
    // drawArrays: steps 0, 1, 2, … fetch vertices first, first+1, first+2, …
    for (let k = 0; k < draw.count; k++) seq.push({ vertex: draw.first + k, indexPosition: null });
  } else {
    // drawElements: step k fetches the vertex whose number is indices[k].
    for (let k = 0; k < draw.elementCount; k++) {
      seq.push({ vertex: k < indices.length ? indices[k] : null, indexPosition: k });
    }
  }
  return seq;
}

// The vertex shader's output for one vertex, and how it was worked out
// (as text with the numbers filled in). This mirrors the GLSL in section 4.
function vertexShaderJS(id, aColor) {
  switch (vsChoice) {
    case 'aColor':
      return { color: aColor, how: 'aColor (from the buffer)' };
    case 'id': {
      const p = id % 8;
      return { color: PALETTE[p].rgb, palette: p, how: `uPalette[${id} % 8] = uPalette[${p}] (${PALETTE[p].name})` };
    }
    case 'tri': {
      // GLSL integer division drops the remainder, like Math.floor here
      // (gl_VertexID is never negative).
      const t = Math.floor(id / 3);
      const p = t % 8;
      return { color: PALETTE[p].rgb, palette: p, how: `uPalette[(${id} / 3) % 8] = uPalette[${t} % 8] = uPalette[${p}] (${PALETTE[p].name})` };
    }
    case 'bary': {
      const corner = id % 3;
      const color = [corner === 0 ? 1 : 0, corner === 1 ? 1 : 0, corner === 2 ? 1 : 0];
      return { color, corner, how: `corner = ${id} % 3 = ${corner}, so vColor = (${color.join(', ')})` };
    }
  }
}

// Run the "vertex shader" for every step of the draw.
function simulateRuns() {
  const n = vertexCount();
  return drawSequence().map((s, k) => {
    const run = { step: k, vertex: s.vertex, indexPosition: s.indexPosition };
    if (s.vertex === null) { run.problem = 'no index'; return run; }
    if (s.vertex >= n) { run.problem = 'no vertex'; return run; }
    const f = s.vertex * FLOATS_PER_VERTEX;
    run.position = [vertexData[f], vertexData[f + 1]];
    run.aColor = [vertexData[f + 2], vertexData[f + 3], vertexData[f + 4]];
    run.out = vertexShaderJS(s.vertex, run.aColor);
    return run;
  });
}

// TRIANGLES groups the steps in threes: 0-1-2, 3-4-5, … A leftover step or
// two at the end does not make a triangle and is skipped.
function groupTriangles() {
  const list = [];
  for (let t = 0; 3 * t + 2 < runs.length; t++) {
    const r = [runs[3 * t], runs[3 * t + 1], runs[3 * t + 2]];
    if (r.every(run => run.out)) list.push({ t, runs: r });
  }
  return list;
}

// Barycentric coordinates of point p in triangle a, b, c (2D points
// [x, y]): the weights λ0, λ1, λ2 with p = λ0·a + λ1·b + λ2·c and
// λ0 + λ1 + λ2 = 1. All three are ≥ 0 exactly when p is inside.
function barycentric(p, a, b, c) {
  const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (den === 0) return null;   // A flat triangle (all 3 on one line) covers nothing.
  const l0 = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / den;
  const l1 = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / den;
  return [l0, l1, 1 - l0 - l1];
}

function weightedSum(lambda, values) {
  return values[0].map((_, i) => lambda[0] * values[0][i] + lambda[1] * values[1][i] + lambda[2] * values[2][i]);
}

// The "edges" fragment shader in JavaScript. d = the smallest component of
// vColor; fwidth(d) = how much d changes from this pixel to the next, in x
// plus in y. We get that by evaluating d one pixel to the right and one
// pixel up (the GPU compares neighboring fragments the same way).
function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
function edgesColor(d, w) {
  const line = w > 0 ? 1 - smoothstep(w, 2 * w, d) : (d <= 0 ? 1 : 0);
  return [0.93 + (0.1 - 0.93) * line, 0.93 + (0.1 - 0.93) * line, 0.93 + (0.1 - 0.93) * line];
}

// Everything about the fragment at clip-space point p (the center of a
// pixel); pixelSize = the size of one drawing-buffer pixel in clip units.
function simulateFragment(p, pixelSize) {
  // Triangles are drawn in order with no depth test, so the LAST triangle
  // that covers the point is the one we see.
  const covering = [];
  for (const tri of triangles) {
    const pos = tri.runs.map(r => r.position);
    const lambda = barycentric(p, pos[0], pos[1], pos[2]);
    if (lambda && lambda.every(l => l >= -1e-9)) covering.push({ tri, lambda });
  }
  if (covering.length === 0) return { background: true, color: BACKGROUND };

  const { tri, lambda } = covering[covering.length - 1];
  const colors = tri.runs.map(r => r.out.color);
  const result = {
    tri, lambda, colors, covering,
    smooth: weightedSum(lambda, colors),
    flat: colors[2],   // the provoking vertex: the triangle's last vertex
    idSum: lambda[0] * tri.runs[0].vertex + lambda[1] * tri.runs[1].vertex + lambda[2] * tri.runs[2].vertex,
  };
  if (fsChoice === 'smooth') result.color = result.smooth;
  if (fsChoice === 'flat') result.color = result.flat;
  if (fsChoice === 'edges') {
    const pos = tri.runs.map(r => r.position);
    const dAt = q => Math.min(...weightedSum(barycentric(q, pos[0], pos[1], pos[2]), colors));
    result.d = Math.min(...result.smooth);
    result.w = Math.abs(dAt([p[0] + pixelSize[0], p[1]]) - result.d) + Math.abs(dAt([p[0], p[1] + pixelSize[1]]) - result.d);
    result.color = edgesColor(result.d, result.w);
  }
  return result;
}

// Which arguments WebGL will refuse, in words. The error code shown on the
// page always comes from real WebGL; this only explains it.
function drawProblems() {
  const problems = [];
  if (draw.kind === 'elements' && draw.elementCount > indices.length) {
    problems.push(`the draw reads indices[0] to indices[${draw.elementCount - 1}], but the index buffer only has ${indices.length} indices.`);
  }
  const missing = runs.find(r => r.problem === 'no vertex');
  if (missing) {
    problems.push(`step ${missing.step} needs vertex ${missing.vertex}, but the vertex buffer only has ${vertexCount()} vertices (0–${vertexCount() - 1}).`);
  }
  return problems;
}


// -----------------------------------------------------------------------------
// Section 4. The shaders: building the GLSL source for each choice.
// -----------------------------------------------------------------------------
// Shader source code is written in GLSL. Each shader is built as a list of
// lines; a line marked `changes: true` depends on your choices, and is
// highlighted in the listing on the page. The page shows exactly the
// source that WebGL compiles.
//
// One rule shapes this section: in GLSL ES 3.00, an output and the
// matching fragment shader input must use the same interpolation
// qualifier. So when the fragment shader says `flat in vec3 vColor`, the
// vertex shader must say `flat out vec3 vColor` too.

function line(text, changes) {
  return { text, changes: !!changes };
}

function vertexShaderLines(vs, fs) {
  const qualifier = fs === 'flat' ? 'flat ' : '';
  const L = [
    line('#version 300 es'),
    line('// Runs once for every step of the draw call.'),
    line('in vec2 aPosition;          // x, y from the vertex buffer'),
    line('in vec3 aColor;             // r, g, b from the vertex buffer'),
    line('uniform vec3 uPalette[8];   // 8 colors, the same for every vertex'),
    line(`${qualifier}out vec3 vColor;${fs === 'flat' ? '      // flat: not interpolated' : '           // interpolated by the rasterizer'}`, true),
    line(''),
    line('void main() {'),
    line('  gl_Position = vec4(aPosition, 0.0, 1.0);   // already in clip space'),
    line('  // gl_VertexID (an int) is the number of the vertex this step fetched.'),
  ];
  if (vs === 'aColor') {
    L.push(line('  vColor = aColor;           // gl_VertexID is not used', true));
  } else if (vs === 'id') {
    L.push(line('  vColor = uPalette[gl_VertexID % 8];   // one color per vertex number', true));
  } else if (vs === 'tri') {
    L.push(line('  // Integer division drops the remainder: 0, 1, 2 → 0; 3, 4, 5 → 1; …', true));
    L.push(line('  vColor = uPalette[(gl_VertexID / 3) % 8];', true));
  } else {
    L.push(line('  int corner = gl_VertexID % 3;        // 0, 1 or 2', true));
    L.push(line('  if (corner == 0) vColor = vec3(1.0, 0.0, 0.0);', true));
    L.push(line('  else if (corner == 1) vColor = vec3(0.0, 1.0, 0.0);', true));
    L.push(line('  else vColor = vec3(0.0, 0.0, 1.0);', true));
  }
  L.push(line('}'));
  return L;
}

function fragmentShaderLines(fs) {
  const L = [
    line('#version 300 es'),
    line('// Runs once for every fragment of every triangle.'),
    line('precision mediump float;'),
  ];
  if (fs === 'smooth') {
    L.push(line('in vec3 vColor;        // interpolated: λ0·c0 + λ1·c1 + λ2·c2', true));
  } else if (fs === 'flat') {
    L.push(line('flat in vec3 vColor;   // the value of the triangle\'s last vertex', true));
  } else {
    L.push(line('in vec3 vColor;        // interpolated; with the barycentric vertex', true));
    L.push(line('                       // shader, these are λ0, λ1, λ2', true));
  }
  L.push(line('out vec4 fragColor;'));
  L.push(line(''));
  L.push(line('void main() {'));
  if (fs === 'edges') {
    L.push(line('  // On an edge one of λ0, λ1, λ2 is 0, so the smallest one is 0.', true));
    L.push(line('  float d = min(vColor.r, min(vColor.g, vColor.b));', true));
    L.push(line('  float w = fwidth(d);   // how much d changes from one pixel to the next', true));
    L.push(line('  float edge = 1.0 - smoothstep(w, 2.0 * w, d);   // 1 near an edge, else 0', true));
    L.push(line('  fragColor = vec4(mix(vec3(0.93), vec3(0.1), edge), 1.0);', true));
  } else {
    L.push(line('  fragColor = vec4(vColor, 1.0);', true));
  }
  L.push(line('}'));
  return L;
}

const sourceOf = lines => lines.map(l => l.text).join('\n') + '\n';


// -----------------------------------------------------------------------------
// Section 5. Real WebGL 2: buffers, the draw, and reading a pixel back.
// -----------------------------------------------------------------------------

const glCanvas = document.getElementById('gl-canvas');
// preserveDrawingBuffer keeps the picture after it is shown, so the
// inspector can read a pixel back with gl.readPixels at any time.
const gl = glCanvas.getContext('webgl2', { preserveDrawingBuffer: true });
const RESULT_SIZE = 320;   // The result canvas is 320 × 320 CSS pixels.

// The attribute locations are fixed with bindAttribLocation, so every
// program uses the same ones and one buffer setup works for all of them.
const LOCATION = { aPosition: 0, aColor: 1 };

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

// One program per pair of choices, compiled the first time it is needed.
const programs = {};
function getProgram(vs, fs) {
  const key = vs + '/' + fs;
  if (!programs[key]) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, sourceOf(vertexShaderLines(vs, fs))));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, sourceOf(fragmentShaderLines(fs))));
    gl.bindAttribLocation(program, LOCATION.aPosition, 'aPosition');
    gl.bindAttribLocation(program, LOCATION.aColor, 'aColor');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    programs[key] = program;
  }
  return programs[key];
}

const ERROR_NAMES = gl ? {
  [gl.INVALID_ENUM]: 'INVALID_ENUM',
  [gl.INVALID_VALUE]: 'INVALID_VALUE',
  [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
  [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
} : {};

let glObjects = [];   // The buffers from the latest run, deleted by the next.
let vao = null;

// Set up the buffers, draw, and return WebGL's error name (or null).
function runWebGL() {
  // Housekeeping: start every run from a clean slate. Attribute settings
  // live in a "vertex array object"; a fresh one each run means nothing is
  // left over from the previous run.
  if (vao) gl.deleteVertexArray(vao);
  for (const b of glObjects) gl.deleteBuffer(b);
  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // The vertex buffer, interleaved x, y, r, g, b (see the buffer
  // playground for how these calls work).
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(LOCATION.aPosition);
  gl.vertexAttribPointer(LOCATION.aPosition, 2, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(LOCATION.aColor);
  gl.vertexAttribPointer(LOCATION.aColor, 3, gl.FLOAT, false, STRIDE, 2 * BYTES_PER_FLOAT);
  glObjects = [vertexBuffer];

  if (draw.kind === 'elements') {
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    glObjects.push(indexBuffer);
  }

  const program = getProgram(vsChoice, fsChoice);
  gl.useProgram(program);
  gl.uniform3fv(gl.getUniformLocation(program, 'uPalette'), PALETTE.flatMap(c => c.rgb));

  gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  gl.clearColor(BACKGROUND[0], BACKGROUND[1], BACKGROUND[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  while (gl.getError() !== gl.NO_ERROR) { /* clear errors from the setup */ }

  if (draw.kind === 'arrays') gl.drawArrays(gl.TRIANGLES, draw.first, draw.count);
  else gl.drawElements(gl.TRIANGLES, draw.elementCount, gl.UNSIGNED_SHORT, 0);
  const code = gl.getError();
  return code === gl.NO_ERROR ? null : (ERROR_NAMES[code] || String(code));
}

// The color WebGL drew at drawing-buffer pixel (ix, iy), counted from the
// top left. readPixels counts rows from the BOTTOM, so the row is flipped.
function readPixel(ix, iy) {
  const out = new Uint8Array(4);
  gl.readPixels(ix, glCanvas.height - 1 - iy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return [out[0], out[1], out[2]];
}


// -----------------------------------------------------------------------------
// Section 6. The memory picture (Canvas 2D).
// -----------------------------------------------------------------------------
// The index buffer (for drawElements) as a row of boxes, then the vertex
// buffer as groups of 5 floats, one group per vertex. The selected step's
// index box and the vertex it points to are highlighted.

const memCanvas = document.getElementById('memory');
const mctx = memCanvas.getContext('2d');

const MARGIN = 8;
const TITLE_H = 22;      // height of a block's title line
const BLOCK_GAP = 12;
const BOX_H = 22;
const LABEL_H = 12;      // the small label above each box
const INDEX_W = 34;      // width of one index box
const FLOAT_W = 42;      // width of one float box
const GROUP_HEAD = 15;   // the "vertex v" line above each vertex group
const GROUP_GAP = 12;
const INDEX_ROW_H = LABEL_H + BOX_H + 8;
const VERTEX_ROW_H = GROUP_HEAD + LABEL_H + BOX_H + 10;
const PURPLE = '#7b3fb5';

function formatValue(v) {
  return v.toFixed(2);
}

function drawBox(x, y, w, text, label, o) {
  o = o || {};
  if (o.fill) { mctx.fillStyle = o.fill; mctx.fillRect(x, y + LABEL_H, w, BOX_H); }
  mctx.strokeStyle = o.dashed ? '#bbb' : '#888';
  mctx.lineWidth = 1;
  mctx.setLineDash(o.dashed ? [3, 3] : []);
  mctx.strokeRect(x + 0.5, y + LABEL_H + 0.5, w - 1, BOX_H - 1);
  mctx.setLineDash([]);
  mctx.textAlign = 'center';
  mctx.fillStyle = o.textColor || (o.dashed ? '#aaa' : '#222');
  mctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
  mctx.fillText(text, x + w / 2, y + LABEL_H + BOX_H / 2);
  if (label) {
    mctx.fillStyle = '#888';
    mctx.font = '10px system-ui, sans-serif';
    mctx.fillText(label, x + w / 2, y + LABEL_H / 2);
  }
}

function drawTitle(text, y) {
  mctx.fillStyle = '#222';
  mctx.font = '600 13px system-ui, sans-serif';
  mctx.textAlign = 'left';
  mctx.fillText(text, MARGIN, y + 10);
}

function drawMemory() {
  const width = memCanvas.clientWidth;
  const usable = Math.max(120, width - 2 * MARGIN);
  const showIndex = draw.kind === 'elements';
  const indexBoxes = showIndex ? Math.max(indices.length, draw.elementCount) : 0;
  const perIndexRow = Math.max(1, Math.floor(usable / INDEX_W));
  const indexRows = showIndex ? Math.max(1, Math.ceil(indexBoxes / perIndexRow)) : 0;
  const groupW = FLOATS_PER_VERTEX * FLOAT_W;
  const perVertexRow = Math.max(1, Math.floor((usable + GROUP_GAP) / (groupW + GROUP_GAP)));
  const vertexRows = Math.ceil(vertexCount() / perVertexRow);

  const indexTop = 4;
  const vertexTop = indexTop + (showIndex ? TITLE_H + indexRows * INDEX_ROW_H + BLOCK_GAP : 0);
  const height = vertexTop + TITLE_H + vertexRows * VERTEX_ROW_H + 4;

  // High-DPI: the drawing buffer is CSS size × devicePixelRatio, then we
  // scale the context so we can keep drawing in CSS pixels.
  const dpr = window.devicePixelRatio || 1;
  memCanvas.style.height = height + 'px';
  memCanvas.width = Math.round(width * dpr);
  memCanvas.height = Math.round(height * dpr);
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mctx.clearRect(0, 0, width, height);
  mctx.textBaseline = 'middle';

  const current = runs[step];

  // ---- The index buffer. ----
  if (showIndex) {
    drawTitle(`indexBuffer  (ELEMENT_ARRAY_BUFFER, Uint16Array: ${indices.length} indices)`, indexTop);
    for (let k = 0; k < indexBoxes; k++) {
      const x = MARGIN + (k % perIndexRow) * INDEX_W;
      const y = indexTop + TITLE_H + Math.floor(k / perIndexRow) * INDEX_ROW_H;
      const inside = k < indices.length;
      const used = k < draw.elementCount;
      const selected = current && current.indexPosition === k;
      drawBox(x, y, INDEX_W, inside ? String(indices[k]) : '?', `[${k}]`, {
        dashed: !inside,
        fill: selected ? PURPLE : (used ? '#e9dcf5' : null),
        textColor: selected ? '#fff' : null,
      });
      // A darker line between triangles (after every third index).
      if (k % 3 === 2 && k % perIndexRow !== perIndexRow - 1) {
        mctx.fillStyle = '#555';
        mctx.fillRect(x + INDEX_W - 1, y + LABEL_H - 2, 2, BOX_H + 4);
      }
    }
  }

  // ---- The vertex buffer. ----
  drawTitle(`vertexBuffer  (ARRAY_BUFFER, Float32Array: ${vertexCount()} vertices × 5 floats = ${vertexData.byteLength} bytes)`, vertexTop);
  const fetched = new Set(runs.map(r => r.vertex));
  for (let v = 0; v < vertexCount(); v++) {
    const x = MARGIN + (v % perVertexRow) * (groupW + GROUP_GAP);
    const y = vertexTop + TITLE_H + Math.floor(v / perVertexRow) * VERTEX_ROW_H;
    const selected = current && current.vertex === v;
    const used = fetched.has(v);
    // The group heading: the vertex number and its bytes.
    mctx.textAlign = 'left';
    mctx.font = (selected ? '600 ' : '') + '11px system-ui, sans-serif';
    mctx.fillStyle = used ? '#222' : '#aaa';
    mctx.fillText(`vertex ${v}${used ? '' : ' (not fetched)'}`, x, y + 6);
    mctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
    mctx.fillStyle = '#999';
    mctx.textAlign = 'right';
    mctx.fillText(`bytes ${v * STRIDE}–${v * STRIDE + STRIDE - 1}`, x + groupW, y + 6);
    for (let c = 0; c < FLOATS_PER_VERTEX; c++) {
      drawBox(x + c * FLOAT_W, y + GROUP_HEAD, FLOAT_W, formatValue(vertexData[v * FLOATS_PER_VERTEX + c]), LABELS[c], {
        fill: selected ? '#fff3c4' : null,
        textColor: used ? null : '#aaa',
      });
    }
    if (selected) {
      mctx.strokeStyle = '#222';
      mctx.lineWidth = 2;
      mctx.strokeRect(x - 1, y + GROUP_HEAD + LABEL_H - 1, groupW + 2, BOX_H + 2);
    }
  }
}


// -----------------------------------------------------------------------------
// Section 7. The result overlay and the fragment inspector.
// -----------------------------------------------------------------------------
// WebGL draws the triangles; this 2D canvas on top labels the vertices,
// outlines the selected step's triangle, marks provoking vertices, and
// catches clicks. Clip space runs from -1 to 1 with y up; canvas pixels run
// down from the top left.

const el = id => document.getElementById(id);
const overlay = el('overlay');
const octx = overlay.getContext('2d');
{
  const dpr = window.devicePixelRatio || 1;
  overlay.width = Math.round(RESULT_SIZE * dpr);
  overlay.height = Math.round(RESULT_SIZE * dpr);
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clipToCanvas(p) {
  return { x: (p[0] + 1) / 2 * RESULT_SIZE, y: (1 - p[1]) / 2 * RESULT_SIZE };
}

function drawOverlay() {
  octx.clearRect(0, 0, RESULT_SIZE, RESULT_SIZE);
  octx.fillStyle = '#999';
  octx.font = '10px system-ui, sans-serif';
  octx.textBaseline = 'alphabetic';
  octx.textAlign = 'left'; octx.fillText('(-1, -1)', 3, RESULT_SIZE - 4);
  octx.textAlign = 'right'; octx.fillText('(1, 1)', RESULT_SIZE - 3, 12);

  // The selected step's triangle, as a dashed outline.
  const selectedTri = triangles.find(tri => tri.t === Math.floor(step / 3));
  if (selectedTri) {
    const pts = selectedTri.runs.map(r => clipToCanvas(r.position));
    octx.strokeStyle = '#222';
    octx.lineWidth = 1.5;
    octx.setLineDash([5, 3]);
    octx.beginPath();
    octx.moveTo(pts[0].x, pts[0].y); octx.lineTo(pts[1].x, pts[1].y); octx.lineTo(pts[2].x, pts[2].y);
    octx.closePath();
    octx.stroke();
    octx.setLineDash([]);
  }

  // With flat, mark each triangle's provoking vertex: a diamond just inside
  // the triangle, next to its last vertex.
  if (fsChoice === 'flat') {
    for (const tri of triangles) {
      const pts = tri.runs.map(r => clipToCanvas(r.position));
      const cx = (pts[0].x + pts[1].x + pts[2].x) / 3, cy = (pts[0].y + pts[1].y + pts[2].y) / 3;
      const mx = pts[2].x + 0.25 * (cx - pts[2].x), my = pts[2].y + 0.25 * (cy - pts[2].y);
      octx.fillStyle = '#fff';
      octx.strokeStyle = '#222';
      octx.lineWidth = 1.5;
      octx.beginPath();
      octx.moveTo(mx, my - 6); octx.lineTo(mx + 6, my); octx.lineTo(mx, my + 6); octx.lineTo(mx - 6, my);
      octx.closePath();
      octx.fill(); octx.stroke();
    }
  }

  // Label each vertex number once. Vertices at the same spot share one
  // label ("v0, v3"): two different vertices stored at the same position.
  const spots = [];
  for (const r of runs) {
    if (!r.position) continue;
    const p = clipToCanvas(r.position);
    let spot = spots.find(s => Math.hypot(s.x - p.x, s.y - p.y) < 3);
    if (!spot) { spot = { x: p.x, y: p.y, vertices: [] }; spots.push(spot); }
    if (!spot.vertices.includes(r.vertex)) spot.vertices.push(r.vertex);
  }
  octx.font = '11px system-ui, sans-serif';
  octx.textBaseline = 'middle';
  for (const s of spots) {
    octx.fillStyle = '#222';
    octx.beginPath(); octx.arc(s.x, s.y, 3, 0, 2 * Math.PI); octx.fill();
    // Put the label on the side away from the center, inside the canvas.
    const text = s.vertices.map(v => 'v' + v).join(', ');
    const w = octx.measureText(text).width;
    let lx = s.x < RESULT_SIZE / 2 ? s.x - 8 - w : s.x + 8;
    if (Math.abs(s.x - RESULT_SIZE / 2) < 2) lx = s.x + 6;
    lx = Math.max(2, Math.min(RESULT_SIZE - w - 2, lx));
    let ly = s.y + (s.y < RESULT_SIZE / 2 ? -10 : 10);
    if (Math.abs(s.y - RESULT_SIZE / 2) < 2) ly = s.y - 10;
    ly = Math.max(8, Math.min(RESULT_SIZE - 8, ly));
    octx.fillStyle = 'rgba(255,255,255,0.85)';
    octx.fillRect(lx - 2, ly - 7, w + 4, 14);
    octx.fillStyle = '#222';
    octx.textAlign = 'left';
    octx.fillText(text, lx, ly);
  }

  // A ring around the selected step's vertex.
  const sel = runs[step];
  if (sel && sel.position) {
    const p = clipToCanvas(sel.position);
    octx.strokeStyle = '#222';
    octx.lineWidth = 2;
    octx.beginPath(); octx.arc(p.x, p.y, 7, 0, 2 * Math.PI); octx.stroke();
  }

  // The clicked point: a small crosshair.
  if (clicked) {
    octx.strokeStyle = '#000';
    octx.lineWidth = 1.5;
    octx.beginPath();
    octx.moveTo(clicked.x - 8, clicked.y); octx.lineTo(clicked.x - 3, clicked.y);
    octx.moveTo(clicked.x + 3, clicked.y); octx.lineTo(clicked.x + 8, clicked.y);
    octx.moveTo(clicked.x, clicked.y - 8); octx.lineTo(clicked.x, clicked.y - 3);
    octx.moveTo(clicked.x, clicked.y + 3); octx.lineTo(clicked.x, clicked.y + 8);
    octx.stroke();
  }

  el('legend').textContent = 'vN = vertex number N (its gl_VertexID). Dashed: the selected step\'s triangle.' +
    (fsChoice === 'flat' ? ' ◇ = each triangle\'s provoking (last) vertex.' : '') +
    ' Click anywhere to inspect a fragment.';
}

overlay.addEventListener('click', e => {
  const r = overlay.getBoundingClientRect();
  clicked = { x: e.clientX - r.left, y: e.clientY - r.top };
  drawOverlay();
  renderInspector();
});

// ---- Small formatting helpers. ----
function swatch(rgb) {
  const c = rgb.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255));
  return `<span class="swatch" style="background:rgb(${c.join(',')})"></span>`;
}
function vec(v, digits) {
  return '(' + v.map(x => x.toFixed(digits === undefined ? 2 : digits)).join(', ') + ')';
}
function to255(rgb) {
  return rgb.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255));
}

// ---- The fragment inspector. ----
function renderInspector() {
  if (!clicked) {
    el('inspector').innerHTML = '<p class="hint">Click a point on the result. The inspector ' +
      'works out what the fragment shader receives there, and compares it ' +
      'with the color WebGL actually drew.</p>';
    return;
  }
  // The drawing-buffer pixel under the click, and its center in clip space.
  // (The rasterizer evaluates each fragment at its pixel's center.)
  const W = glCanvas.width, H = glCanvas.height;
  const ix = Math.min(W - 1, Math.floor(clicked.x / RESULT_SIZE * W));
  const iy = Math.min(H - 1, Math.floor(clicked.y / RESULT_SIZE * H));
  const p = [(ix + 0.5) / W * 2 - 1, 1 - (iy + 0.5) / H * 2];
  const f = simulateFragment(p, [2 / W, 2 / H]);
  const actual = readPixel(ix, iy);
  const predicted = to255(f.color);
  const parts = [];

  parts.push(`<div>Point (${p[0].toFixed(3)}, ${p[1].toFixed(3)}) in clip space.</div>`);
  if (f.background) {
    parts.push('<div>No triangle covers this point, so no fragment shader runs here: ' +
      'this is the background (the clear color).</div>');
  } else {
    const { tri, lambda } = f;
    const [r0, r1, r2] = tri.runs;
    parts.push(`<div><b>Triangle ${tri.t}</b>: steps ${r0.step}, ${r1.step}, ${r2.step}, ` +
      `which fetched vertices <b>${r0.vertex}, ${r1.vertex}, ${r2.vertex}</b>.` +
      (f.covering.length > 1 ? ` (${f.covering.length} triangles cover this point; triangle ${tri.t} was drawn last, so it is on top.)` : '') +
      '</div>');
    parts.push(`<div>Barycentric coordinates: λ0 = ${lambda[0].toFixed(3)}, λ1 = ${lambda[1].toFixed(3)}, ` +
      `λ2 = ${lambda[2].toFixed(3)} (they add up to 1).</div>`);

    const smoothClass = fsChoice === 'flat' ? 'unused' : 'used';
    const flatClass = fsChoice === 'flat' ? 'used' : 'unused';
    parts.push(`<div class="${smoothClass}">Interpolated vColor = λ0·${vec(f.colors[0])} + λ1·${vec(f.colors[1])} + ` +
      `λ2·${vec(f.colors[2])} = ${swatch(f.smooth)}<b>${vec(f.smooth, 3)}</b>` +
      (fsChoice === 'flat' ? ' (not used: the input is flat)' : '') + '</div>');
    parts.push(`<div class="${flatClass}">flat vColor = the value of the last vertex (step ${r2.step}, ` +
      `vertex ${r2.vertex}) = ${swatch(f.flat)}<b>${vec(f.flat)}</b>` +
      (fsChoice === 'flat' ? '' : ' (not used: the input is interpolated)') + '</div>');
    if (fsChoice === 'edges') {
      parts.push(`<div>d = smallest component = ${f.d.toFixed(3)}; fwidth(d) ≈ ${f.w.toFixed(4)}. ` +
        (f.d < 2 * f.w ? 'd is within about 2 pixels of 0, so this fragment is on a line.' : 'd is far from 0, so this fragment is not on a line.') + '</div>');
    }
    // What if we interpolated the vertex NUMBER itself?
    parts.push(`<div class="hint">If the vertex shader output float(gl_VertexID), this fragment would ` +
      `receive λ0·${r0.vertex} + λ1·${r1.vertex} + λ2·${r2.vertex} = <b>${f.idSum.toFixed(2)}</b>. ` +
      'An interpolated number like this is not a vertex number: the fragment shader cannot know an index.</div>');
  }

  const close = predicted.every((v, i) => Math.abs(v - actual[i]) <= 3);
  parts.push(`<div>Predicted color: ${swatch(f.color)}(${predicted.join(', ')}) &nbsp; ` +
    `WebGL drew: ${swatch(actual.map(v => v / 255))}(${actual.join(', ')}) &nbsp; ` +
    (close ? '<span class="ok">✓ match</span>' : '<span class="bad">differ</span>' +
      (fsChoice === 'edges' ? ' (the edge of a line is sensitive to rounding; try a point nearby)' : '')) + '</div>');
  el('inspector').innerHTML = parts.join('');
}


// -----------------------------------------------------------------------------
// Section 8. The other views: explanation, runs table, code listings.
// -----------------------------------------------------------------------------

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- The explanation above the memory picture, for the selected step. ----
function renderStepExplain() {
  const r = runs[step];
  if (!r) {
    el('step-explain').innerHTML = '<div>This draw call has no steps (its count is 0).</div>';
    return;
  }
  const parts = [];
  if (draw.kind === 'arrays') {
    parts.push(`<b>Step ${step}</b>: drawArrays fetches vertex first + ${step} = ${draw.first} + ${step} = <b>${r.vertex}</b>, ` +
      `so <code>gl_VertexID = ${r.vertex}</code>.`);
  } else if (r.vertex === null) {
    parts.push(`<b>Step ${step}</b>: drawElements needs indices[${step}], which is <span class="bad">past the end of the index buffer</span>.`);
  } else {
    parts.push(`<b>Step ${step}</b>: drawElements reads <b style="color:${PURPLE}">indices[${step}] = ${r.vertex}</b> and fetches vertex ` +
      `<b>${r.vertex}</b>, so <code>gl_VertexID = ${r.vertex}</code>` +
      (r.vertex !== step ? ` (the index value, not the step number ${step}).` : '.'));
  }
  if (r.problem === 'no vertex') {
    parts.push(`<span class="bad">There is no vertex ${r.vertex}: the buffer has vertices 0–${vertexCount() - 1}.</span>`);
  } else if (r.out) {
    parts.push(`Vertex shader: <code>vColor = ${escapeHtml(r.out.how)}</code> ${swatch(r.out.color)}`);
    const same = runs.filter(o => o.vertex === r.vertex && o.step !== step).map(o => o.step);
    if (same.length) parts.push(`Steps ${same.join(', ')} fetch the same vertex, so they get exactly the same outputs.`);
  }
  el('step-explain').innerHTML = parts.map(p => `<div>${p}</div>`).join('');
}

// ---- The vertex shader runs table. ----
function renderRuns() {
  if (runs.length === 0) { el('runs').innerHTML = '<p class="hint">No steps: the count is 0.</p>'; return; }
  const elements = draw.kind === 'elements';
  let html = '<table><tr><th>step</th><th>triangle</th>' + (elements ? '<th>index read</th>' : '') +
    '<th>gl_VertexID</th><th>aPosition</th><th>aColor</th><th>vColor (output)</th><th></th></tr>';
  for (const r of runs) {
    const t = Math.floor(r.step / 3);
    const whole = triangles.some(tri => tri.t === t);
    const classes = ['vertex-row'];
    if (r.step === step) classes.push('current');
    if (r.step % 3 === 0 && r.step > 0) classes.push('triangle-start');
    html += `<tr class="${classes.join(' ')}" data-step="${r.step}"><td>${r.step}</td><td>${whole ? t : '— (skipped)'}</td>`;
    if (elements) html += `<td>${r.vertex === null ? '<span class="bad">none</span>' : `indices[${r.step}] = ${r.vertex}`}</td>`;
    if (!r.out) {
      html += `<td>${r.vertex === null ? '—' : r.vertex}</td><td colspan="4" class="bad">${r.problem === 'no index' ? 'no index here' : `no vertex ${r.vertex} in the buffer`}</td></tr>`;
      continue;
    }
    const same = runs.filter(o => o.vertex === r.vertex && o.step !== r.step).map(o => o.step);
    const tags = [];
    if (same.length) tags.push(`<span class="tag shared">same vertex as step${same.length > 1 ? 's' : ''} ${same.join(', ')}</span>`);
    if (r.step % 3 === 2 && whole) {
      tags.push(`<span class="tag${fsChoice === 'flat' ? ' provoking' : ''}">last of triangle ${t}${fsChoice === 'flat' ? ': provoking' : ''}</span>`);
    }
    html += `<td><b>${r.vertex}</b></td><td class="mono">${vec(r.position)}</td>` +
      `<td class="mono">${swatch(r.aColor)}${vec(r.aColor)}</td>` +
      `<td class="mono">${swatch(r.out.color)}${vec(r.out.color)}${r.out.palette !== undefined ? ` ${PALETTE[r.out.palette].name}` : ''}</td>` +
      `<td>${tags.join(' ')}</td></tr>`;
  }
  html += '</table>';
  el('runs').innerHTML = html;
  for (const tr of el('runs').querySelectorAll('tr.vertex-row')) {
    tr.addEventListener('click', () => { step = Number(tr.dataset.step); update(); });
  }
}

// ---- Code listings. ----
function renderLines(lines) {
  return lines.map(l => {
    const at = l.text.indexOf('//');
    let html = at >= 0
      ? escapeHtml(l.text.slice(0, at)) + `<span class="comment">${escapeHtml(l.text.slice(at))}</span>`
      : escapeHtml(l.text);
    if (l.changes) html = `<span class="changes">${html}</span>`;
    return html;
  }).join('\n');
}

function renderShaders() {
  el('vs-code').innerHTML = renderLines(vertexShaderLines(vsChoice, fsChoice));
  el('fs-code').innerHTML = renderLines(fragmentShaderLines(fsChoice));
}

function renderDrawCode(error) {
  const out = [];
  out.push('<span class="comment">// The vertex buffer (x, y, r, g, b per vertex) and its attributes are set up as in');
  out.push('// the buffer playground. Then:</span>');
  if (draw.kind === 'elements') {
    out.push(`const indexData = new Uint16Array([${indices.join(', ')}]);   <span class="comment">// in the index buffer</span>`);
  }
  out.push('gl.useProgram(program);');
  out.push('gl.uniform3fv(uPaletteLocation, palette);   <span class="comment">// 8 colors × 3 floats</span>');
  if (draw.kind === 'arrays') out.push(`gl.drawArrays(gl.TRIANGLES, ${draw.first}, ${draw.count});`);
  else out.push(`gl.drawElements(gl.TRIANGLES, ${draw.elementCount}, gl.UNSIGNED_SHORT, 0);`);
  if (error) {
    const why = drawProblems();
    out.push(`<span class="error">    // ✗ ${error}: ${escapeHtml(why.length ? why.join(' ') : 'WebGL refused this call.')} Nothing was drawn.</span>`);
  }
  el('draw-code').innerHTML = out.join('\n');
}

function renderDrawReport(error) {
  let html;
  if (error) {
    html = `<span class="bad">✗ WebGL refused the draw call (${error}), so nothing was drawn.</span> ` +
      escapeHtml(drawProblems().join(' '));
  } else {
    const n = runs.length;
    const count = triangles.length;
    html = `<span class="ok">✓ Drew ${count} triangle${count === 1 ? '' : 's'} from ${n} step${n === 1 ? '' : 's'}.</span>`;
    if (n % 3) html += ` The last ${n % 3} step${n % 3 === 1 ? ' does' : 's do'} not make a whole triangle, so ${n % 3 === 1 ? 'it is' : 'they are'} skipped.`;
    if (drawProblems().length) {
      html += ' <span class="bad">Some steps have no vertex.</span> This browser drew anyway; others refuse the draw.';
    }
  }
  el('draw-report').innerHTML = html;
}


// -----------------------------------------------------------------------------
// Section 9. The side panel: controls, and update().
// -----------------------------------------------------------------------------

function readInt(id, max) {
  const n = parseInt(el(id).value, 10);
  return isNaN(n) || n < 0 ? 0 : Math.min(n, max);
}

const VS_HINTS = {
  aColor: 'Ignores gl_VertexID: the color comes from the vertex buffer.',
  id: 'Vertex 0 gets palette color 0, vertex 1 color 1, and so on (8 colors, then they repeat).',
  tri: 'Integer division: vertices 0–2 get color 0, 3–5 color 1, … This is the triangle number only when the vertices are numbered in triangle order.',
  bary: 'Each vertex gets (1,0,0), (0,1,0) or (0,0,1). Interpolated, these are the fragment\'s barycentric coordinates, but only if every triangle\'s 3 vertices get 3 different ones.',
};
const FS_HINTS = {
  smooth: 'The rasterizer interpolates vColor: a fragment with barycentric coordinates λ0, λ1, λ2 gets λ0·c0 + λ1·c1 + λ2·c2.',
  flat: 'No interpolation: every fragment of a triangle gets the value of its last vertex, the provoking vertex (◇ on the result).',
  edges: 'Treats the interpolated vColor as barycentric coordinates and draws a line where one is near 0. Use it with the barycentric vertex shader.',
};

// State → controls (after loading a preset, or adding/removing indices).
function syncControls() {
  el('preset').value = String(presetIndex);
  el('preset-note').textContent = PRESETS[presetIndex].note;
  el('kind-arrays').checked = draw.kind === 'arrays';
  el('kind-elements').checked = draw.kind === 'elements';
  el('kind-elements').disabled = !indices;
  el('arrays-first').value = draw.first;
  el('arrays-count').value = draw.count;
  el('elements-count').value = draw.elementCount;
  for (const input of document.querySelectorAll('input[name="vs"]')) input.checked = input.value === vsChoice;
  for (const input of document.querySelectorAll('input[name="fs"]')) input.checked = input.value === fsChoice;
  el('index-editor').innerHTML = (indices || []).map((v, i) =>
    `<input type="number" min="0" max="99" step="1" value="${v}" data-pos="${i}" title="indices[${i}]"` +
    `${i % 3 === 2 ? ' class="triangle-end"' : ''}>`).join('');
  for (const input of el('index-editor').querySelectorAll('input')) {
    input.addEventListener('input', () => { readControls(); update(); });
  }
}

// Controls → state.
function readControls() {
  draw.kind = el('kind-elements').checked ? 'elements' : 'arrays';
  draw.first = readInt('arrays-first', 60);
  draw.count = readInt('arrays-count', 60);
  draw.elementCount = readInt('elements-count', 60);
  vsChoice = document.querySelector('input[name="vs"]:checked').value;
  fsChoice = document.querySelector('input[name="fs"]:checked').value;
  if (indices) {
    for (const input of el('index-editor').querySelectorAll('input')) {
      indices[Number(input.dataset.pos)] = readIntValue(input.value);
    }
  }
}
function readIntValue(text) {
  const n = parseInt(text, 10);
  return isNaN(n) || n < 0 ? 0 : Math.min(n, 99);
}

function updateHints() {
  el('arrays-controls').style.display = draw.kind === 'arrays' ? '' : 'none';
  el('elements-controls').style.display = draw.kind === 'elements' ? '' : 'none';
  el('draw-hint').textContent = draw.kind === 'arrays'
    ? `Steps 0 to ${draw.count - 1} fetch vertices ${draw.first} to ${draw.first + draw.count - 1}, in order. The buffer has ${vertexCount()} vertices.`
    : `Step k fetches vertex indices[k]. The buffer has ${vertexCount()} vertices (0–${vertexCount() - 1}).` +
      (indices ? '' : ' This starting point has no index buffer.');
  el('vs-hint').textContent = VS_HINTS[vsChoice];
  el('fs-hint').textContent = FS_HINTS[fsChoice];
}

// Redo everything: simulate, run real WebGL, redraw every view.
function update() {
  runs = simulateRuns();
  triangles = groupTriangles();
  step = Math.max(0, Math.min(step, runs.length - 1));

  updateHints();
  const error = runWebGL();
  drawMemory();
  renderStepExplain();
  drawOverlay();
  renderDrawReport(error);
  renderInspector();
  renderRuns();
  renderShaders();
  renderDrawCode(error);
  const r = runs[step];
  el('step-label').textContent = r
    ? `Step ${step} of ${runs.length}: vertex ${r.vertex === null ? '—' : r.vertex}`
    : 'No steps to go through.';
}

// ---- Wire up the controls. ----
el('preset').innerHTML = PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
el('preset').addEventListener('change', () => {
  loadPreset(Number(el('preset').value));
  syncControls();
  update();
});

for (const input of el('panel').querySelectorAll('fieldset input')) {
  input.addEventListener('input', () => { readControls(); update(); });
}

el('index-add').addEventListener('click', () => {
  if (draw.elementCount === indices.length) draw.elementCount++;   // Keep using them all.
  indices.push(0);
  syncControls();
  update();
});
el('index-remove').addEventListener('click', () => {
  if (indices.length === 0) return;
  if (draw.elementCount === indices.length) draw.elementCount--;
  indices.pop();
  syncControls();
  update();
});

el('step-prev').addEventListener('click', () => { step = Math.max(0, step - 1); update(); });
el('step-next').addEventListener('click', () => { step = Math.min(runs.length - 1, step + 1); update(); });

window.addEventListener('resize', drawMemory);

// ---- Start. ----
if (!gl) {
  el('main').innerHTML = '<section><p class="bad">This browser does not support WebGL 2, which this tool needs.</p></section>';
} else {
  // Make the drawing buffer match the screen's pixels (high-DPI screens).
  const dpr = window.devicePixelRatio || 1;
  glCanvas.width = Math.round(RESULT_SIZE * dpr);
  glCanvas.height = Math.round(RESULT_SIZE * dpr);
  loadPreset(0);
  syncControls();
  update();
}
