// =============================================================================
// index.js — An interactive playground for WebGL buffers and attributes.
//
// THE BIG IDEA
// ------------
// A buffer on the GPU is just a row of bytes. WebGL does not know which
// numbers are positions, which are colors, or where one vertex ends and
// the next begins. We tell it, one attribute at a time, with
//
//   gl.vertexAttribPointer(location, size, type, normalized, stride, offset)
//
// and the GPU then finds attribute values for vertex number v with one rule:
//
//   first byte = offset + v × stride
//   it reads   size values of the given type (here FLOAT, 4 bytes each)
//
// (stride 0 is a shortcut for "tightly packed": stride = size × 4 bytes.)
//
// With drawArrays, the vertex numbers are simply first, first+1, first+2…
// With drawElements, they come from a second buffer, the INDEX buffer
// (bound to ELEMENT_ARRAY_BUFFER): the draw call reads indices[0],
// indices[1], … and each index is a vertex number.
//
// HOW THIS TOOL WORKS
// -------------------
// Every time a control changes, the tool does the same draw TWICE:
//   - with REAL WebGL 2 (section 5): the exact calls listed under "The
//     calls that ran", on the exact same data. Its picture and its errors
//     are what a real program would get.
//   - with a JAVASCRIPT COPY of the GPU's reading rule (section 3). The GPU
//     cannot show us which bytes it read, so this copy is what draws the
//     memory picture and the table of vertex shader inputs.
//
// FILE OUTLINE
//   Section 1. The starting points (presets): vertex data and settings.
//   Section 2. The program state.
//   Section 3. The simulator: which bytes each attribute reads.
//   Section 4. WebGL's rules: which arguments WebGL refuses, and why.
//   Section 5. Real WebGL 2: shaders, and running the calls.
//   Section 6. The memory picture (Canvas 2D).
//   Section 7. The other views: explanation, result, inputs, state, calls.
//   Section 8. The side panel: controls, and update() which redraws it all.
// =============================================================================


// -----------------------------------------------------------------------------
// Section 1. The starting points (presets).
// -----------------------------------------------------------------------------
// Each preset is a complete set of arguments: the vertex data in each
// buffer, an optional index buffer, the vertexAttribPointer settings for
// both attributes, and the draw call. They build up from one triangle to
// the layout used by the course's cube examples.
//
// Each buffer also has `labels`: what the PROGRAMMER means each float to
// be (x, y, r, g, b, …). The labels are only for the memory picture. WebGL
// never sees them, which is the whole point.

const BYTES_PER_FLOAT = 4;   // A FLOAT is 32 bits = 4 bytes.
const BYTES_PER_INDEX = 2;   // An UNSIGNED_SHORT index is 16 bits = 2 bytes.

// The value an attribute gets when it is DISABLED (set with vertexAttrib4f).
// Every vertex gets this same value.
const CONSTANTS = {
  aPosition: [0, 0, 0, 1],
  aColor: [0.6, 0.6, 0.6, 1],   // gray
};

const ATTRIBUTE_NAMES = ['aPosition', 'aColor'];

// Corner positions and colors used by the presets. Positions are in clip
// space, where the visible area runs from -1 to 1 in x and y.
const RED = [1, 0, 0], GREEN = [0, 1, 0], BLUE = [0, 0, 1], YELLOW = [1, 0.85, 0];
const TRIANGLE = [[0, 0.7], [-0.7, -0.5], [0.7, -0.5]];
const TRIANGLE_COLORS = [RED, GREEN, BLUE];
const SQUARE = [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]];
const SQUARE_COLORS = [RED, GREEN, BLUE, YELLOW];
// The two triangles of a square, as corner numbers: 0-1-2 and 0-2-3.
const SQUARE_TRIANGLES = [0, 1, 2, 0, 2, 3];
// The front face (+z) of the cube in the course examples, with each cube
// corner's color = its position + 0.5 (as in 4-vertex-interpolation.js).
const FACE = [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]];
const FACE_NORMALS = [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]];
const FACE_COLORS = [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];

// Join per-vertex lists into one flat array, vertex by vertex:
// interleave([[x,y],…], [[r,g,b],…]) gives [x,y,r,g,b, x,y,r,g,b, …].
function interleave(...lists) {
  const out = [];
  for (let v = 0; v < lists[0].length; v++) {
    for (const list of lists) out.push(...list[v]);
  }
  return out;
}

// Pick entries of a list in a given order (to repeat shared corners).
function pick(list, order) {
  return order.map(i => list[i]);
}

// Shorthand for one attribute's settings.
function attr(enabled, buffer, size, stride, offset) {
  return { enabled, buffer, size, stride, offset };
}

const PRESETS = [
  {
    name: '1. Triangle: positions only',
    note: 'One buffer holding x, y for 3 vertices (6 floats = 24 bytes). ' +
      'aColor is disabled, so every vertex gets the same constant gray.',
    buffers: [{ name: 'positionBuffer', labels: ['x', 'y'], data: interleave(TRIANGLE) }],
    indices: null,
    attributes: { aPosition: attr(true, 0, 2, 0, 0), aColor: attr(false, 0, 3, 0, 0) },
    draw: { kind: 'arrays', first: 0, count: 3 },
  },
  {
    name: '2. Triangle: colors in a second buffer',
    note: 'Positions and colors live in two separate buffers. Each ' +
      'vertexAttribPointer call reads from whichever buffer is bound to ' +
      'ARRAY_BUFFER at that moment, so we bind before each one.',
    buffers: [
      { name: 'positionBuffer', labels: ['x', 'y'], data: interleave(TRIANGLE) },
      { name: 'colorBuffer', labels: ['r', 'g', 'b'], data: interleave(TRIANGLE_COLORS) },
    ],
    indices: null,
    attributes: { aPosition: attr(true, 0, 2, 0, 0), aColor: attr(true, 1, 3, 0, 0) },
    draw: { kind: 'arrays', first: 0, count: 3 },
  },
  {
    name: '3. Triangle: interleaved in one buffer',
    note: 'One buffer; each vertex is x, y, r, g, b (5 floats = 20 bytes). ' +
      'Both attributes use stride 20. aColor starts 8 bytes into each vertex.',
    buffers: [{ name: 'vertexBuffer', labels: ['x', 'y', 'r', 'g', 'b'], data: interleave(TRIANGLE, TRIANGLE_COLORS) }],
    indices: null,
    attributes: { aPosition: attr(true, 0, 2, 20, 0), aColor: attr(true, 0, 3, 20, 8) },
    draw: { kind: 'arrays', first: 0, count: 3 },
  },
  {
    name: '4. Square: two triangles with drawArrays',
    note: 'A square is two triangles = 6 vertices, but it has only 4 ' +
      'different corners: two of them are stored twice.',
    buffers: [{
      name: 'vertexBuffer', labels: ['x', 'y', 'r', 'g', 'b'],
      data: interleave(pick(SQUARE, SQUARE_TRIANGLES), pick(SQUARE_COLORS, SQUARE_TRIANGLES)),
    }],
    indices: null,
    attributes: { aPosition: attr(true, 0, 2, 20, 0), aColor: attr(true, 0, 3, 20, 8) },
    draw: { kind: 'arrays', first: 0, count: 6 },
  },
  {
    name: '5. Square: indexed, with drawElements',
    note: 'Each corner is stored once (4 vertices). The index buffer lists ' +
      'which vertex to use for each triangle corner: 0, 1, 2 and 0, 2, 3.',
    buffers: [{ name: 'vertexBuffer', labels: ['x', 'y', 'r', 'g', 'b'], data: interleave(SQUARE, SQUARE_COLORS) }],
    indices: SQUARE_TRIANGLES,
    attributes: { aPosition: attr(true, 0, 2, 20, 0), aColor: attr(true, 0, 3, 20, 8) },
    draw: { kind: 'elements', count: 6, offset: 0 },
  },
  {
    name: "6. Cube face: the cube examples' layout",
    note: 'One face of the cube from the course examples. Each vertex is ' +
      'x, y, z, nx, ny, nz, r, g, b (9 floats = 36 bytes). No attribute ' +
      'reads the normal here: the stride simply steps over it.',
    buffers: [{
      name: 'vertexBuffer', labels: ['x', 'y', 'z', 'nx', 'ny', 'nz', 'r', 'g', 'b'],
      data: interleave(pick(FACE, SQUARE_TRIANGLES), pick(FACE_NORMALS, SQUARE_TRIANGLES), pick(FACE_COLORS, SQUARE_TRIANGLES)),
    }],
    indices: null,
    attributes: { aPosition: attr(true, 0, 3, 36, 0), aColor: attr(true, 0, 3, 36, 24) },
    draw: { kind: 'arrays', first: 0, count: 6 },
  },
  {
    name: '7. Cube face: indexed',
    note: 'The same face with 4 vertices and an index buffer. Sharing works ' +
      'within one face, because its 4 corners have the same normal. Across ' +
      'faces it does not: a cube corner has a different normal on each of ' +
      'its 3 faces. That is why the cube examples store 36 vertices.',
    buffers: [{
      name: 'vertexBuffer', labels: ['x', 'y', 'z', 'nx', 'ny', 'nz', 'r', 'g', 'b'],
      data: interleave(FACE, FACE_NORMALS, FACE_COLORS),
    }],
    indices: SQUARE_TRIANGLES,
    attributes: { aPosition: attr(true, 0, 3, 36, 0), aColor: attr(true, 0, 3, 36, 24) },
    draw: { kind: 'elements', count: 6, offset: 0 },
  },
];


// -----------------------------------------------------------------------------
// Section 2. The program state.
// -----------------------------------------------------------------------------
// Everything the views depend on lives in these variables. Every control
// changes them and then calls update() (section 8) to redo everything.

let presetIndex = 0;
let buffers = [];      // [{ name, labels, data: Float32Array }]
let indices = null;    // The index buffer's values (a plain array), or null.
let attributes = {};   // { aPosition: {enabled, buffer, size, stride, offset}, aColor: … }
let draw = {};         // { kind: 'arrays' | 'elements', first, count, elementCount, elementOffset }
let step = 0;          // Which vertex of the draw call is selected (0, 1, 2, …).
let showAll = true;    // Show every vertex's reads in the memory picture?

// Results of the simulator for the current settings (filled by update()).
let sequence = [];     // The vertices the draw call visits, in order.
let inputs = [];       // inputs[k] = { aPosition: read, aColor: read } for step k.

// Copy a preset into the state (copies, so editing never changes PRESETS).
function loadPreset(i) {
  const p = PRESETS[i];
  presetIndex = i;
  buffers = p.buffers.map(b => ({ name: b.name, labels: b.labels, data: new Float32Array(b.data) }));
  indices = p.indices ? p.indices.slice() : null;
  attributes = {};
  for (const name of ATTRIBUTE_NAMES) attributes[name] = { ...p.attributes[name] };
  draw = {
    kind: p.draw.kind,
    first: p.draw.first || 0,
    count: p.draw.kind === 'arrays' ? p.draw.count : 3,
    elementCount: p.draw.kind === 'elements' ? p.draw.count : 0,
    elementOffset: p.draw.kind === 'elements' ? p.draw.offset : 0,
  };
  step = 0;
}


// -----------------------------------------------------------------------------
// Section 3. The simulator: which bytes each attribute reads.
// -----------------------------------------------------------------------------
// This is a JavaScript copy of what the GPU does for each vertex. It only
// does the READING (buffer bytes → attribute values); the real WebGL in
// section 5 does the drawing.

// stride 0 means "tightly packed": the values of one vertex follow right
// after the previous vertex's, so the step is size × 4 bytes.
function effectiveStride(a) {
  return a.stride === 0 ? a.size * BYTES_PER_FLOAT : a.stride;
}

// The vertices the draw call visits, in order:
//   { vertex: the vertex number (or null if there is none),
//     indexPosition: which entry of the index buffer it came from (drawElements) }
function drawSequence() {
  const seq = [];
  if (draw.kind === 'arrays') {
    // drawArrays(mode, first, count): vertices first, first+1, …, first+count-1.
    for (let k = 0; k < draw.count; k++) seq.push({ vertex: draw.first + k, indexPosition: null });
  } else {
    // drawElements(mode, count, type, offset): offset is in BYTES into the
    // index buffer, so the first index used is indices[offset / 2].
    const firstPosition = Math.floor(draw.elementOffset / BYTES_PER_INDEX);
    for (let k = 0; k < draw.elementCount; k++) {
      const pos = firstPosition + k;
      seq.push({ vertex: pos < indices.length ? indices[pos] : null, indexPosition: pos });
    }
  }
  return seq;
}

// What attribute `name` receives for vertex number `vertex`. Returns
//   value:  the 4 components the vertex shader sees (it declares vec4)
//   filled: filled[c] is true when component c was NOT read from the
//           buffer. WebGL fills missing components with 0, 0, 0, 1, so
//           size 2 gives (x, y, 0, 1).
//   start, end: the bytes read are start … end-1
//   outside: true if some of those bytes are past the end of the buffer
function readAttribute(name, vertex) {
  const a = attributes[name];
  if (!a.enabled) {
    // A disabled attribute reads nothing: every vertex gets the constant.
    return { fromBuffer: false, value: CONSTANTS[name].slice(), filled: [false, false, false, false] };
  }
  if (vertex === null) return { fromBuffer: true, missing: true };

  const buf = buffers[a.buffer];
  const start = a.offset + vertex * effectiveStride(a);   // THE rule.
  const end = start + a.size * BYTES_PER_FLOAT;
  // A DataView reads a number of any type at any byte address. We read
  // little-endian floats, the byte order Float32Array uses on every
  // common computer. Unlike the GPU, a DataView can read at an address
  // that is not a multiple of 4, so the tool can show what a misaligned
  // read WOULD mean, even though WebGL refuses one (section 4).
  const view = new DataView(buf.data.buffer);
  const value = [0, 0, 0, 1];
  const filled = [true, true, true, true];
  let outside = false;
  for (let c = 0; c < a.size; c++) {
    const at = start + c * BYTES_PER_FLOAT;
    filled[c] = false;
    if (at + BYTES_PER_FLOAT <= buf.data.byteLength) {
      value[c] = view.getFloat32(at, true);
    } else {
      value[c] = null;   // Past the end of the buffer: no data here.
      outside = true;
    }
  }
  return { fromBuffer: true, start, end, value, filled, outside };
}


// -----------------------------------------------------------------------------
// Section 4. WebGL's rules: which arguments WebGL refuses, and why.
// -----------------------------------------------------------------------------
// WebGL checks the arguments of each call. When it refuses one, the call
// does NOTHING (the state stays as it was) and gl.getError() reports an
// error code. These functions predict the refusals so the tool can
// explain them in words. The error codes shown on screen always come
// from real WebGL; the words come from here.

// Each problem is { error: 'INVALID_OPERATION' or 'INVALID_VALUE', text }.
function pointerProblems(a) {
  const problems = [];
  if (a.stride > 255) {
    problems.push({ error: 'INVALID_VALUE', text: 'stride can be at most 255 bytes.' });
  }
  // The GPU reads a FLOAT as one 4-byte unit, so every float it reads
  // must start at a multiple of 4. Both stride and offset must keep it there.
  if (a.stride % BYTES_PER_FLOAT !== 0) {
    problems.push({ error: 'INVALID_OPERATION', text: `stride must be a multiple of 4 bytes (the size of one FLOAT); ${a.stride} is not. Stride and offset are in BYTES, not floats.` });
  }
  if (a.offset % BYTES_PER_FLOAT !== 0) {
    problems.push({ error: 'INVALID_OPERATION', text: `offset must be a multiple of 4 bytes (the size of one FLOAT); ${a.offset} is not. Stride and offset are in BYTES, not floats.` });
  }
  return problems;
}

function drawProblems() {
  const problems = [];
  if (draw.kind === 'elements') {
    const n = indices.length;
    if (draw.elementOffset % BYTES_PER_INDEX !== 0) {
      problems.push({ error: 'INVALID_OPERATION', text: `the offset into the index buffer must be a multiple of 2 bytes (the size of one UNSIGNED_SHORT); ${draw.elementOffset} is not.` });
    } else if (draw.elementOffset / BYTES_PER_INDEX + draw.elementCount > n) {
      const a = draw.elementOffset / BYTES_PER_INDEX;
      problems.push({ error: 'INVALID_OPERATION', text: `this draw reads indices[${a}] to indices[${a + draw.elementCount - 1}], but the index buffer only has indices[0] to indices[${n - 1}].` });
    }
  }
  for (const name of ATTRIBUTE_NAMES) {
    const a = attributes[name];
    if (a.enabled && pointerProblems(a).length > 0) {
      problems.push({ error: 'INVALID_OPERATION', text: `${name} is enabled, but its vertexAttribPointer call was refused, so it has no buffer to read from.` });
    }
  }
  const outside = outsideReads();
  if (outside.length > 0) {
    const o = outside[0];
    const r = inputs[o.step][o.name];
    const buf = buffers[attributes[o.name].buffer];
    problems.push({ error: 'INVALID_OPERATION', text: `at step ${o.step}, ${o.name} would read bytes ${r.start}–${r.end - 1} of ${buf.name}, which has only ${buf.data.byteLength} bytes (0–${buf.data.byteLength - 1}). WebGL checks this and refuses the draw instead of reading outside the buffer.` });
  }
  return problems;
}

// Reads past the end of a vertex buffer. WebGL never lets a draw read
// memory outside a buffer: depending on the browser it either refuses the
// draw (INVALID_OPERATION; Chrome does this) or reads zeros or values from
// inside the buffer.
function outsideReads() {
  const found = [];
  inputs.forEach((row, k) => {
    for (const name of ATTRIBUTE_NAMES) {
      if (row[name].outside) found.push({ step: k, name });
    }
  });
  return found;
}


// -----------------------------------------------------------------------------
// Section 5. Real WebGL 2: shaders, and running the calls.
// -----------------------------------------------------------------------------
// Shader source code is written in GLSL. Each shader string below is
// marked twice, so that both common editors color its GLSL syntax:
//   // language=GLSL  is read by JetBrains IDEs (WebStorm, PyCharm),
//   /* glsl */        is read by the VS Code "Comment tagged templates"
//                    extension.
// In WebGL 2, `#version 300 es` must be the very first line of the source.

const glCanvas = document.getElementById('gl-canvas');
const gl = glCanvas.getContext('webgl2');
const RESULT_SIZE = 300;   // The result canvas is 300 × 300 CSS pixels.

// The vertex shader declares both attributes as vec4, even though our data
// has 2 or 3 numbers per position and 3 per color. That way students can
// see how WebGL fills in the components the buffer does not supply.
// language=GLSL
const vertexShaderSource = /* glsl */ `#version 300 es
in vec4 aPosition;   // filled from a buffer (or a constant), once per vertex
in vec4 aColor;
out vec4 vColor;     // passed on to the rasterizer, which interpolates it

void main() {
  gl_Position = aPosition;   // positions are already in clip space
  vColor = aColor;
}
`;

// The fragment shader ignores the alpha component: otherwise a wrong
// alpha read from the buffer would make the canvas see-through.
// language=GLSL
const fragmentShaderSource = /* glsl */ `#version 300 es
precision mediump float;
in vec4 vColor;      // interpolated across the triangle
out vec4 fragColor;

void main() {
  fragColor = vec4(vColor.rgb, 1.0);
}
`;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

let program = null;
if (gl) {
  // Make the drawing buffer match the screen's pixels (high-DPI screens).
  const dpr = window.devicePixelRatio || 1;
  glCanvas.width = Math.round(RESULT_SIZE * dpr);
  glCanvas.height = Math.round(RESULT_SIZE * dpr);

  program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShaderSource));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
}

// gl.getError() returns a number; these are the names a programmer sees.
const ERROR_NAMES = gl ? {
  [gl.INVALID_ENUM]: 'INVALID_ENUM',
  [gl.INVALID_VALUE]: 'INVALID_VALUE',
  [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
  [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
} : {};

// The WebGL objects from the latest run, so the next run can delete them.
let glBuffers = {};    // { positionBuffer: WebGLBuffer, … }
let vao = null;

// The data arrays get names in the listing: positionBuffer → positionData.
function dataName(bufferName) {
  return bufferName.replace('Buffer', 'Data');
}

// Run every call with real WebGL, checking gl.getError() after each one.
// Returns the list of lines for "The calls that ran" (section 7):
//   { kind: 'comment', text } or
//   { kind: 'call', text, error: null or an error name, problems }
function runCalls() {
  const lines = [];
  const comment = text => lines.push({ kind: 'comment', text });
  // Run one call, then ask WebGL whether it refused it. `problems` are
  // section 4's predictions, used to explain an error in words.
  function call(text, run, problems) {
    run();
    const code = gl.getError();
    const error = code === gl.NO_ERROR ? null : (ERROR_NAMES[code] || String(code));
    lines.push({ kind: 'call', text, error, problems: problems || [] });
    return error;
  }

  // Housekeeping, not part of the lesson: start every run from a clean
  // slate, as if the page had just loaded. Attribute settings live in a
  // "vertex array object"; every WebGL program has a default one. We
  // make a fresh one each run so that nothing is left over from the
  // previous run (for example, the settings of a call that WebGL refuses
  // this time). The listed calls work exactly as they would without it.
  if (vao) gl.deleteVertexArray(vao);
  for (const b of Object.values(glBuffers)) gl.deleteBuffer(b);
  glBuffers = {};
  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  while (gl.getError() !== gl.NO_ERROR) { /* clear old errors */ }

  // ---- 1. Copy the data into buffers on the GPU. ----
  comment('// 1. Copy the vertex data into buffers on the GPU.');
  for (const buf of buffers) {
    call(`const ${buf.name} = gl.createBuffer();`,
      () => { glBuffers[buf.name] = gl.createBuffer(); });
    call(`gl.bindBuffer(gl.ARRAY_BUFFER, ${buf.name});`,
      () => gl.bindBuffer(gl.ARRAY_BUFFER, glBuffers[buf.name]));
    call(`gl.bufferData(gl.ARRAY_BUFFER, ${dataName(buf.name)}, gl.STATIC_DRAW);   // ${buf.data.byteLength} bytes`,
      () => gl.bufferData(gl.ARRAY_BUFFER, buf.data, gl.STATIC_DRAW));
  }
  if (indices) {
    // ELEMENT_ARRAY_BUFFER means "this buffer holds indices".
    call('const indexBuffer = gl.createBuffer();',
      () => { glBuffers.indexBuffer = gl.createBuffer(); });
    call('gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);',
      () => gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glBuffers.indexBuffer));
    call(`gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);   // ${indices.length * BYTES_PER_INDEX} bytes`,
      () => gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW));
  }

  // ---- 2. Tell WebGL how to read each attribute. ----
  comment('');
  comment('// 2. Tell WebGL how to read each attribute.');
  for (const name of ATTRIBUTE_NAMES) {
    const a = attributes[name];
    const location = gl.getAttribLocation(program, name);
    call(`const ${name} = gl.getAttribLocation(program, '${name}');   // ${location}`, () => {});
    if (a.enabled) {
      const bufName = buffers[a.buffer].name;
      call(`gl.bindBuffer(gl.ARRAY_BUFFER, ${bufName});`,
        () => gl.bindBuffer(gl.ARRAY_BUFFER, glBuffers[bufName]));
      call(`gl.enableVertexAttribArray(${name});`,
        () => gl.enableVertexAttribArray(location));
      call(`gl.vertexAttribPointer(${name}, ${a.size}, gl.FLOAT, false, ${a.stride}, ${a.offset});`,
        () => gl.vertexAttribPointer(location, a.size, gl.FLOAT, false, a.stride, a.offset),
        pointerProblems(a));
    } else {
      const c = CONSTANTS[name];
      call(`gl.disableVertexAttribArray(${name});`,
        () => gl.disableVertexAttribArray(location));
      call(`gl.vertexAttrib4f(${name}, ${c.join(', ')});   // one value for every vertex`,
        () => gl.vertexAttrib4f(location, c[0], c[1], c[2], c[3]));
    }
    comment('');
  }

  // ---- 3. Draw. ----
  comment('// 3. Draw.');
  gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  gl.clearColor(0.97, 0.97, 0.97, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  call('gl.useProgram(program);', () => gl.useProgram(program));
  if (draw.kind === 'arrays') {
    call(`gl.drawArrays(gl.TRIANGLES, ${draw.first}, ${draw.count});`,
      () => gl.drawArrays(gl.TRIANGLES, draw.first, draw.count),
      drawProblems());
  } else {
    call(`gl.drawElements(gl.TRIANGLES, ${draw.elementCount}, gl.UNSIGNED_SHORT, ${draw.elementOffset});`,
      () => gl.drawElements(gl.TRIANGLES, draw.elementCount, gl.UNSIGNED_SHORT, draw.elementOffset),
      drawProblems());
  }
  return lines;
}


// -----------------------------------------------------------------------------
// Section 6. The memory picture (Canvas 2D).
// -----------------------------------------------------------------------------
// One block per buffer. In a vertex buffer, every byte is BYTE_W pixels
// wide, so a float is a box 4 × BYTE_W wide, and a read of `size` floats
// starting at any byte is a bar under exactly those bytes. Long buffers
// wrap onto several rows. When possible, a row holds whole vertices of the
// layout the programmer intended, so interleaved data lines up in columns.
//
// Under the bytes are two "lanes", one per attribute. A bar in a lane is
// one read: solid for the selected vertex, faint for the others.

const memCanvas = document.getElementById('memory');
const mctx = memCanvas.getContext('2d');

const BYTE_W = 12;         // Pixels per byte in a vertex buffer (a float is 48 px).
const INDEX_BYTE_W = 16;   // Pixels per byte in the index buffer (an index is 32 px).
const MARGIN = 8;
const HEADER_H = 22;       // Height of a block's title line.
const BLOCK_GAP = 12;
const COLORS = { aPosition: '#1f5fbf', aColor: '#d0700a', index: '#7b3fb5', bad: '#c0262d' };
const LANE = { aPosition: 0, aColor: 1 };
// The vertical layout of one row, in pixels from the top of the row.
const ROW = { label: 10, cellTop: 14, cellH: 24, tick: 38, address: 50, laneTop: 56, laneH: 13, laneGap: 3 };
const VERTEX_ROW_H = ROW.laneTop + 2 * (ROW.laneH + ROW.laneGap) + 4;
const INDEX_ROW_H = ROW.address + 8;
const MAX_PAST_END = 96;   // At most this many bytes past a buffer's end are drawn.

// Number formatting for the boxes: short, but never misleading.
function formatValue(v) {
  if (v === null) return '?';
  const abs = Math.abs(v);
  if (v !== 0 && (abs < 0.005 || abs >= 1000)) return v.toExponential(1);
  return v.toFixed(2);
}

// Split the byte range start … end-1 into pieces that each fit on one row.
// Calls fn(row, from, to) with byte positions measured within the row.
function forEachRowPiece(start, end, bytesPerRow, fn) {
  let s = start;
  while (s < end) {
    const row = Math.floor(s / bytesPerRow);
    const e = Math.min(end, (row + 1) * bytesPerRow);
    fn(row, s - row * bytesPerRow, e - row * bytesPerRow);
    s = e;
  }
}

// Work out where every block goes. Returns { blocks, height }.
function memoryLayout(width) {
  const usable = Math.max(100, width - 2 * MARGIN);
  const blocks = [];
  let y = 4;

  if (draw.kind === 'elements') {
    const bytes = Math.max(indices.length, draw.elementOffset / BYTES_PER_INDEX + draw.elementCount) * BYTES_PER_INDEX;
    const shownBytes = Math.min(Math.ceil(bytes / 2) * 2, indices.length * BYTES_PER_INDEX + MAX_PAST_END);
    let bytesPerRow = Math.floor(usable / INDEX_BYTE_W);
    bytesPerRow -= bytesPerRow % BYTES_PER_INDEX;
    const rows = Math.max(1, Math.ceil(shownBytes / bytesPerRow));
    blocks.push({ kind: 'index', y, bytesPerRow, rows, shownBytes });
    y += HEADER_H + rows * INDEX_ROW_H + BLOCK_GAP;
  }

  buffers.forEach((buf, bufIndex) => {
    // Show the buffer, plus any bytes past its end that a read reaches.
    let shownBytes = buf.data.byteLength;
    inputs.forEach(row => {
      for (const name of ATTRIBUTE_NAMES) {
        const r = row[name];
        if (r.fromBuffer && !r.missing && attributes[name].buffer === bufIndex) shownBytes = Math.max(shownBytes, r.end);
      }
    });
    shownBytes = Math.min(Math.ceil(shownBytes / 4) * 4, buf.data.byteLength + MAX_PAST_END);

    // Fit whole vertices per row if we can, otherwise whole floats.
    const maxBytes = Math.floor(usable / BYTE_W);
    const vertexBytes = buf.labels.length * BYTES_PER_FLOAT;
    let bytesPerRow = Math.floor(maxBytes / vertexBytes) * vertexBytes;
    if (bytesPerRow === 0) bytesPerRow = Math.floor(maxBytes / 4) * 4;
    const rows = Math.max(1, Math.ceil(shownBytes / bytesPerRow));
    blocks.push({ kind: 'buffer', buf, bufIndex, y, bytesPerRow, rows, shownBytes });
    y += HEADER_H + rows * VERTEX_ROW_H + BLOCK_GAP;
  });

  return { blocks, height: y };
}

function drawMemory() {
  const width = memCanvas.clientWidth;
  const layout = memoryLayout(width);
  // High-DPI: the drawing buffer is CSS size × devicePixelRatio, then we
  // scale the context so we can keep drawing in CSS pixels.
  const dpr = window.devicePixelRatio || 1;
  memCanvas.style.height = layout.height + 'px';
  memCanvas.width = Math.round(width * dpr);
  memCanvas.height = Math.round(layout.height * dpr);
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mctx.clearRect(0, 0, width, layout.height);
  mctx.textBaseline = 'middle';

  for (const block of layout.blocks) {
    if (block.kind === 'index') drawIndexBlock(block);
    else drawBufferBlock(block);
  }
}

function drawTitle(text, y) {
  mctx.fillStyle = '#222';
  mctx.font = '600 13px system-ui, sans-serif';
  mctx.textAlign = 'left';
  mctx.fillText(text, MARGIN, y + 10);
}

// One box: a value with a small label above it.
function drawBox(x, y, w, value, label, options) {
  const o = options || {};
  if (o.fill) {
    mctx.fillStyle = o.fill;
    mctx.fillRect(x, y + ROW.cellTop, w, ROW.cellH);
  }
  mctx.strokeStyle = o.outside ? '#bbb' : '#888';
  mctx.lineWidth = 1;
  mctx.setLineDash(o.outside ? [3, 3] : []);
  mctx.strokeRect(x + 0.5, y + ROW.cellTop + 0.5, w - 1, ROW.cellH - 1);
  mctx.setLineDash([]);
  if (o.thickLeft) {
    mctx.fillStyle = '#444';
    mctx.fillRect(x, y + ROW.cellTop, 2, ROW.cellH);
  }
  mctx.textAlign = 'center';
  mctx.fillStyle = o.textColor || (o.outside ? '#aaa' : '#222');
  mctx.font = (value.length > 5 ? '10px ' : '11px ') + 'ui-monospace, Menlo, Consolas, monospace';
  mctx.fillText(value, x + w / 2, y + ROW.cellTop + ROW.cellH / 2);
  if (label) {
    mctx.fillStyle = '#888';
    mctx.font = '10px system-ui, sans-serif';
    mctx.fillText(label, x + w / 2, y + ROW.label);
  }
}

// Byte ticks under a row of boxes, with an address every `every` bytes.
function drawRuler(y, rowStart, rowBytes, byteW, every) {
  mctx.fillStyle = '#999';
  mctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
  mctx.textAlign = 'center';
  for (let b = 0; b <= rowBytes; b++) {
    const x = MARGIN + b * byteW;
    const big = (rowStart + b) % every === 0;
    mctx.fillRect(x, y + ROW.tick, 1, big ? 5 : 3);
    if (big) mctx.fillText(String(rowStart + b), x, y + ROW.address);
  }
}

function drawIndexBlock(block) {
  const n = indices.length;
  drawTitle(`indexBuffer  (ELEMENT_ARRAY_BUFFER, Uint16Array: ${n} indices = ${n * BYTES_PER_INDEX} bytes)`, block.y);
  const top = block.y + HEADER_H;
  const firstPos = draw.elementOffset / BYTES_PER_INDEX;
  const current = sequence[step];

  for (let r = 0; r < block.rows; r++) {
    const y = top + r * INDEX_ROW_H;
    const rowStart = r * block.bytesPerRow;
    const rowBytes = Math.min(block.bytesPerRow, block.shownBytes - rowStart);
    for (let pos = rowStart / BYTES_PER_INDEX; pos * BYTES_PER_INDEX < rowStart + rowBytes; pos++) {
      const x = MARGIN + (pos * BYTES_PER_INDEX - rowStart) * INDEX_BYTE_W;
      const w = BYTES_PER_INDEX * INDEX_BYTE_W;
      const inside = pos < n;
      const used = Number.isInteger(firstPos) && pos >= firstPos && pos < firstPos + draw.elementCount;
      const isCurrent = current && current.indexPosition === pos;
      drawBox(x, y, w, inside ? String(indices[pos]) : '?', `[${pos}]`, {
        outside: !inside,
        fill: isCurrent ? COLORS.index : (used ? '#e9dcf5' : null),
        textColor: isCurrent ? '#fff' : null,
      });
    }
    drawRuler(y, rowStart, rowBytes, INDEX_BYTE_W, BYTES_PER_INDEX);
  }
}

function drawBufferBlock(block) {
  const { buf, bufIndex, bytesPerRow } = block;
  const bytes = buf.data.byteLength;
  // Which attributes read from this buffer?
  const readers = ATTRIBUTE_NAMES.filter(n => attributes[n].enabled && attributes[n].buffer === bufIndex);
  const title = `${buf.name}  (ARRAY_BUFFER, Float32Array: ${bytes / BYTES_PER_FLOAT} floats = ${bytes} bytes)`;
  drawTitle(title, block.y);
  // Then "read by aPosition and aColor", each name in its lane's color.
  let x = MARGIN + mctx.measureText(title).width;
  const pieces = readers.length === 0 ? [['   no attribute reads it', '#888']]
    : [['   read by ', '#222']].concat(...readers.map((n, i) => (i ? [[' and ', '#222']] : []).concat([[n, COLORS[n]]])));
  for (const [text, color] of pieces) {
    mctx.fillStyle = color;
    mctx.fillText(text, x, block.y + 10);
    x += mctx.measureText(text).width;
  }
  const top = block.y + HEADER_H;
  const rowY = row => top + row * VERTEX_ROW_H;

  // 1. Tint the bytes the selected vertex reads, in each attribute's color.
  const currentRow = inputs[step];
  if (currentRow) {
    for (const name of readers) {
      const r = currentRow[name];
      if (r.missing) continue;
      mctx.globalAlpha = 0.22;
      mctx.fillStyle = COLORS[name];
      forEachRowPiece(r.start, Math.min(r.end, block.shownBytes), bytesPerRow, (row, from, to) => {
        mctx.fillRect(MARGIN + from * BYTE_W, rowY(row) + ROW.cellTop, (to - from) * BYTE_W, ROW.cellH);
      });
      mctx.globalAlpha = 1;
    }
  }

  // 2. The boxes (one per float) and the byte ruler, row by row.
  const vertexFloats = buf.labels.length;
  for (let r = 0; r < block.rows; r++) {
    const y = rowY(r);
    const rowStart = r * bytesPerRow;
    const rowBytes = Math.min(bytesPerRow, block.shownBytes - rowStart);
    for (let f = rowStart / 4; f * 4 < rowStart + rowBytes; f++) {
      const x = MARGIN + (f * 4 - rowStart) * BYTE_W;
      const inside = f * 4 < bytes;
      drawBox(x, y, 4 * BYTE_W, inside ? formatValue(buf.data[f]) : '?',
        inside ? buf.labels[f % vertexFloats] : (f * 4 === bytes ? 'past end' : ''),
        { outside: !inside, thickLeft: inside && f % vertexFloats === 0 && vertexFloats > 1 });
    }
    drawRuler(y, rowStart, rowBytes, BYTE_W, 4);
  }

  // 3. The reads, as bars in each attribute's lane. Each vertex number is
  //    drawn once (with drawElements the same vertex can be used twice).
  const selectedVertex = sequence[step] ? sequence[step].vertex : null;
  for (const name of readers) {
    const refused = pointerProblems(attributes[name]).length > 0;
    const seen = new Set();
    const bars = [];
    inputs.forEach((row, k) => {
      const v = sequence[k].vertex;
      if (row[name].missing || seen.has(v)) return;
      seen.add(v);
      bars.push({ read: row[name], vertex: v });
    });
    // Faint bars first, so the selected one is drawn on top.
    bars.sort((a, b) => (a.vertex === selectedVertex) - (b.vertex === selectedVertex));
    for (const bar of bars) {
      const selected = bar.vertex === selectedVertex;
      if (!selected && !showAll) continue;
      const label = `v${bar.vertex}${selected && refused ? ' refused' : ''}`;
      drawBar(block, bar.read, LANE[name], refused ? COLORS.bad : COLORS[name], selected, refused, label);
    }
  }
}

// One read, as a bar under the bytes it covers (split across rows if needed).
function drawBar(block, read, lane, color, selected, refused, label) {
  const end = Math.min(read.end, block.shownBytes);
  let first = true;
  forEachRowPiece(read.start, end, block.bytesPerRow, (row, from, to) => {
    if (row >= block.rows) return;
    const x = MARGIN + from * BYTE_W + 1;
    const w = (to - from) * BYTE_W - 2;
    const y = block.y + HEADER_H + row * VERTEX_ROW_H + ROW.laneTop + lane * (ROW.laneH + ROW.laneGap);
    mctx.globalAlpha = selected ? 1 : 0.28;
    if (refused) {
      // A refused read: dashed outline, because WebGL never does it.
      mctx.strokeStyle = color;
      mctx.setLineDash([4, 3]);
      mctx.strokeRect(x + 0.5, y + 0.5, w - 1, ROW.laneH - 1);
      mctx.setLineDash([]);
    } else {
      mctx.fillStyle = color;
      mctx.fillRect(x, y, w, ROW.laneH);
    }
    mctx.globalAlpha = 1;
    if (first) {
      mctx.font = (selected ? '600 ' : '') + '10px system-ui, sans-serif';
      mctx.textAlign = 'left';
      const fits = mctx.measureText(label).width + 6 < w;
      mctx.fillStyle = refused || !fits ? color : (selected ? '#fff' : '#333');
      if (fits) mctx.fillText(label, x + 3, y + ROW.laneH / 2 + 1);
      first = false;
    }
  });
}


// -----------------------------------------------------------------------------
// Section 7. The other views.
// -----------------------------------------------------------------------------

const el = id => document.getElementById(id);

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function colored(name) {
  return `<b style="color:${COLORS[name]}">${name}</b>`;
}

// ---- The explanation above the memory picture: the rule, with numbers. ----
function renderStepExplain() {
  const parts = [];
  const s = sequence[step];
  if (!s) {
    el('step-explain').innerHTML = '<div>This draw call visits no vertices (its count is 0).</div>';
    return;
  }
  if (draw.kind === 'arrays') {
    parts.push(`<b>Step ${step}</b> of the draw: drawArrays uses vertex first + ${step} = ${draw.first} + ${step} = <b>${s.vertex}</b>.`);
  } else if (s.vertex === null) {
    parts.push(`<b>Step ${step}</b> of the draw: it needs indices[${s.indexPosition}], which is <span class="bad">past the end of the index buffer</span>.`);
  } else {
    const byte = draw.elementOffset + step * BYTES_PER_INDEX;
    parts.push(`<b>Step ${step}</b> of the draw: drawElements reads the index at byte offset + ${step} × 2 = ${byte}, ` +
      `which is <b style="color:${COLORS.index}">indices[${s.indexPosition}] = ${s.vertex}</b>. So it uses vertex <b>${s.vertex}</b>.`);
  }
  for (const name of ATTRIBUTE_NAMES) {
    const a = attributes[name];
    const r = inputs[step][name];
    if (!a.enabled) {
      parts.push(`${colored(name)} is disabled: every vertex gets the constant (${CONSTANTS[name].join(', ')}).`);
      continue;
    }
    if (r.missing) continue;
    const stride = effectiveStride(a);
    const strideNote = a.stride === 0 ? ` (stride 0 means tightly packed: size × 4 = ${stride})` : '';
    let text = `${colored(name)}: offset + vertex × stride = ${a.offset} + ${s.vertex} × ${stride}${strideNote} = ${r.start}, ` +
      `so it reads bytes ${r.start}–${r.end - 1} (${a.size} float${a.size > 1 ? 's' : ''}) of ${buffers[a.buffer].name}.`;
    if (pointerProblems(a).length) text += ' <span class="bad">WebGL refused this vertexAttribPointer call, so this read never happens; the picture shows what those bytes would mean.</span>';
    else if (r.outside) text += ` <span class="bad">Part of this is past the end of the buffer (${buffers[a.buffer].data.byteLength} bytes).</span>`;
    parts.push(text);
  }
  el('step-explain').innerHTML = parts.map(p => `<div>${p}</div>`).join('');
}

// ---- The result: an overlay on top of the real WebGL picture. ----
// WebGL draws the triangles; this 2D canvas only labels the vertices, at
// the positions the simulator says aPosition receives. Clip space runs
// from -1 to 1, with y up; canvas pixels run down from the top-left.

const overlay = el('overlay');
const octx = overlay.getContext('2d');
{
  const dpr = window.devicePixelRatio || 1;
  overlay.width = Math.round(RESULT_SIZE * dpr);
  overlay.height = Math.round(RESULT_SIZE * dpr);
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clipToCanvas(x, y) {
  return { x: (x + 1) / 2 * RESULT_SIZE, y: (1 - y) / 2 * RESULT_SIZE };
}

function drawOverlay() {
  octx.clearRect(0, 0, RESULT_SIZE, RESULT_SIZE);
  // Axes through the origin of clip space.
  octx.strokeStyle = 'rgba(0,0,0,0.12)';
  octx.lineWidth = 1;
  octx.beginPath();
  octx.moveTo(RESULT_SIZE / 2 + 0.5, 0); octx.lineTo(RESULT_SIZE / 2 + 0.5, RESULT_SIZE);
  octx.moveTo(0, RESULT_SIZE / 2 + 0.5); octx.lineTo(RESULT_SIZE, RESULT_SIZE / 2 + 0.5);
  octx.stroke();
  octx.fillStyle = '#999';
  octx.font = '10px system-ui, sans-serif';
  octx.textBaseline = 'alphabetic';
  octx.textAlign = 'left'; octx.fillText('(-1, -1)', 3, RESULT_SIZE - 4);
  octx.textAlign = 'right'; octx.fillText('(1, 1)', RESULT_SIZE - 3, 12);

  // Where each step's vertex lands (after the divide by w), or null.
  const points = inputs.map(row => {
    const p = row.aPosition;
    if (p.missing || p.value.some(c => c === null || !isFinite(c)) || !(p.value[3] > 0)) return null;
    return clipToCanvas(p.value[0] / p.value[3], p.value[1] / p.value[3]);
  });

  // The selected vertex's triangle, as a dashed outline.
  const t = Math.floor(step / 3) * 3;
  const tri = [points[t], points[t + 1], points[t + 2]];
  if (tri.every(p => p)) {
    octx.strokeStyle = '#222';
    octx.setLineDash([4, 3]);
    octx.beginPath();
    octx.moveTo(tri[0].x, tri[0].y); octx.lineTo(tri[1].x, tri[1].y); octx.lineTo(tri[2].x, tri[2].y);
    octx.closePath();
    octx.stroke();
    octx.setLineDash([]);
  }

  // Label each vertex number once. Vertices at the same spot share one
  // label ("v0, v3"), which shows corners that are stored twice.
  const spots = [];
  points.forEach((p, k) => {
    if (!p) return;
    const v = sequence[k].vertex;
    let spot = spots.find(s => Math.hypot(s.x - p.x, s.y - p.y) < 3);
    if (!spot) { spot = { x: p.x, y: p.y, vertices: [] }; spots.push(spot); }
    if (!spot.vertices.includes(v)) spot.vertices.push(v);
  });
  octx.font = '11px system-ui, sans-serif';
  octx.textBaseline = 'middle';
  for (const s of spots) {
    octx.fillStyle = '#222';
    octx.beginPath(); octx.arc(s.x, s.y, 3, 0, 2 * Math.PI); octx.fill();
    // Put the label on the side away from the center, inside the canvas.
    const text = s.vertices.map(v => 'v' + v).join(', ');
    const w = octx.measureText(text).width;
    const right = s.x < RESULT_SIZE / 2;
    let lx = right ? s.x - 8 - w : s.x + 8;
    lx = Math.max(2, Math.min(RESULT_SIZE - w - 2, lx));
    const ly = Math.max(8, Math.min(RESULT_SIZE - 8, s.y + (s.y < RESULT_SIZE / 2 ? -10 : 10)));
    octx.fillStyle = 'rgba(255,255,255,0.8)';
    octx.fillRect(lx - 2, ly - 7, w + 4, 14);
    octx.fillStyle = '#222';
    octx.textAlign = 'left';
    octx.fillText(text, lx, ly);
  }

  // A ring around the selected vertex.
  const sel = points[step];
  if (sel) {
    octx.strokeStyle = '#222';
    octx.lineWidth = 2;
    octx.beginPath(); octx.arc(sel.x, sel.y, 7, 0, 2 * Math.PI); octx.stroke();
  }
}

function renderDrawReport(lines) {
  const drawLine = lines[lines.length - 1];
  const count = sequence.length;
  let html;
  if (drawLine.error) {
    html = `<span class="bad">✗ WebGL refused the draw call (${drawLine.error}), so nothing was drawn.</span> See the last line of the calls below.`;
  } else {
    const triangles = Math.floor(count / 3);
    html = `<span class="ok">✓ Drew ${triangles} triangle${triangles === 1 ? '' : 's'} from ${count} vert${count === 1 ? 'ex' : 'ices'}.</span>`;
    if (count % 3) html += ` The last ${count % 3} vert${count % 3 === 1 ? 'ex does' : 'ices do'} not make a whole triangle, so ${count % 3 === 1 ? 'it is' : 'they are'} skipped.`;
    if (outsideReads().length) {
      html += ' <span class="bad">Some reads go past the end of a buffer.</span> WebGL never reads memory outside a buffer: this browser drew anyway, using zeros or values from inside the buffer instead. Other browsers may refuse the draw.';
    }
  }
  el('draw-report').innerHTML = html;
}

// ---- The vertex shader inputs table. ----
function formatVec(read) {
  if (read.missing) return '<span class="bad">no vertex</span>';
  const comps = read.value.map((v, c) => {
    const text = v === null ? '?' : (read.filled[c] ? String(v) : formatValue(v));
    return read.filled[c] ? `<span class="filled">${text}</span>` : text;
  });
  let html = `(${comps.join(', ')})`;
  if (read.outside) html += ' <span class="bad">past end</span>';
  if (!read.fromBuffer) html += ' <span class="filled">constant</span>';
  return html;
}

function renderInputs() {
  const elements = draw.kind === 'elements';
  let html = '<table><tr><th>step</th>' + (elements ? '<th>index</th>' : '') +
    `<th>vertex</th><th style="color:${COLORS.aPosition}">aPosition</th><th style="color:${COLORS.aColor}">aColor</th></tr>`;
  sequence.forEach((s, k) => {
    html += `<tr class="vertex-row${k === step ? ' current' : ''}" data-step="${k}"><td>${k}</td>`;
    if (elements) html += `<td>indices[${s.indexPosition}]</td>`;
    html += `<td>${s.vertex === null ? '—' : s.vertex}</td><td class="mono">${formatVec(inputs[k].aPosition)}</td>` +
      `<td class="mono">${formatVec(inputs[k].aColor)}</td></tr>`;
  });
  html += '</table>';
  if (sequence.length === 0) html = '<p class="hint">No vertices: the count is 0.</p>';
  el('inputs').innerHTML = html;
  // Clicking a row selects that step.
  for (const tr of el('inputs').querySelectorAll('tr.vertex-row')) {
    tr.addEventListener('click', () => { step = Number(tr.dataset.step); update(); });
  }
}

// ---- The WebGL state table, asked from WebGL itself. ----
function bufferNameOf(glBuffer) {
  for (const [name, b] of Object.entries(glBuffers)) if (b === glBuffer) return name;
  return 'null';
}

function renderState() {
  const arrayBinding = bufferNameOf(gl.getParameter(gl.ARRAY_BUFFER_BINDING));
  const elementBinding = bufferNameOf(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING));
  const rows = { location: [], enabled: [], buffer: [], size: [], type: [], stride: [], offset: [], 'constant value': [] };
  for (const name of ATTRIBUTE_NAMES) {
    const loc = gl.getAttribLocation(program, name);
    rows.location.push(loc);
    rows.enabled.push(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_ENABLED));
    rows.buffer.push(bufferNameOf(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)));
    rows.size.push(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_SIZE));
    rows.type.push(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_TYPE) === gl.FLOAT ? 'FLOAT' : '?');
    rows.stride.push(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_STRIDE));
    rows.offset.push(gl.getVertexAttribOffset(loc, gl.VERTEX_ATTRIB_ARRAY_POINTER));
    rows['constant value'].push('(' + Array.from(gl.getVertexAttrib(loc, gl.CURRENT_VERTEX_ATTRIB)).map(v => +v.toFixed(2)).join(', ') + ')');
  }
  let html = '<table>' +
    `<tr><th>ARRAY_BUFFER</th><td colspan="2" class="mono">${arrayBinding}</td></tr>` +
    `<tr><th>ELEMENT_ARRAY_BUFFER</th><td colspan="2" class="mono">${elementBinding}</td></tr>` +
    '</table><p class="hint">ARRAY_BUFFER is just the last buffer bound. Each ' +
    'vertexAttribPointer call saved its own copy of the binding (the "buffer" row below).</p>';
  html += `<table><tr><th></th><th style="color:${COLORS.aPosition}">aPosition</th><th style="color:${COLORS.aColor}">aColor</th></tr>`;
  for (const [label, values] of Object.entries(rows)) {
    html += `<tr><th>${label}</th>${values.map(v => `<td class="mono">${v}</td>`).join('')}</tr>`;
  }
  html += '</table><p class="hint">A disabled attribute keeps its buffer settings but ' +
    'does not use them; it uses the constant value.<br>Settings never set show ' +
    "WebGL's defaults (buffer null, size 4, stride 0, offset 0).</p>";
  el('state').innerHTML = html;
}

// ---- The listing of the calls that ran. ----
// The data arrays first, then every call from runCalls(), with WebGL's
// error (if any) on the line below the call that caused it.
function dataListing() {
  const out = [];
  for (const buf of buffers) {
    const per = buf.labels.length;
    out.push(`<span class="comment">// ${buf.labels.join(', ')} for each vertex</span>`);
    out.push(`const ${dataName(buf.name)} = new Float32Array([`);
    for (let v = 0; v * per < buf.data.length; v++) {
      const nums = Array.from(buf.data.slice(v * per, v * per + per)).map(n => (n < 0 ? '' : ' ') + n.toFixed(2));
      out.push(`  ${nums.join(', ')},   <span class="comment">// vertex ${v}</span>`);
    }
    out.push(']);');
  }
  if (indices) {
    out.push('<span class="comment">// vertex numbers, 3 per triangle</span>');
    out.push(`const indexData = new Uint16Array([${indices.join(', ')}]);`);
  }
  return out;
}

function renderCode(lines) {
  const out = dataListing();
  out.push('');
  for (const line of lines) {
    if (line.kind === 'comment') {
      out.push(`<span class="comment">${escapeHtml(line.text)}</span>`);
      continue;
    }
    // Split off a trailing "// note" so it can be shown as a comment.
    const at = line.text.indexOf('   //');
    const code = at >= 0 ? line.text.slice(0, at) : line.text;
    const note = at >= 0 ? `<span class="comment">${escapeHtml(line.text.slice(at))}</span>` : '';
    out.push(escapeHtml(code) + note);
    if (line.error) {
      const match = line.problems.find(p => p.error === line.error);
      const why = match ? match.text : 'WebGL refused this call.';
      out.push(`<span class="error">    // ✗ ${line.error}: ${escapeHtml(why)} The call did nothing.</span>`);
    }
  }
  el('code').innerHTML = out.join('\n');
}


// -----------------------------------------------------------------------------
// Section 8. The side panel: controls, and update().
// -----------------------------------------------------------------------------

// Read a whole number from an input; anything else counts as 0.
function readInt(id) {
  const n = parseInt(el(id).value, 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

// State → controls (after loading a preset, or adding/removing indices).
function syncControls() {
  el('preset').value = String(presetIndex);
  el('preset-note').textContent = PRESETS[presetIndex].note;
  for (const name of ATTRIBUTE_NAMES) {
    const a = attributes[name];
    el(name + '-enabled').checked = a.enabled;
    el(name + '-buffer').innerHTML = buffers.map((b, i) => `<option value="${i}">${b.name}</option>`).join('');
    el(name + '-buffer').value = String(a.buffer);
    el(name + '-size').value = String(a.size);
    el(name + '-stride').value = a.stride;
    el(name + '-offset').value = a.offset;
  }
  el('kind-arrays').checked = draw.kind === 'arrays';
  el('kind-elements').checked = draw.kind === 'elements';
  el('kind-elements').disabled = !indices;
  el('arrays-first').value = draw.first;
  el('arrays-count').value = draw.count;
  el('elements-count').value = draw.elementCount;
  el('elements-offset').value = draw.elementOffset;
  el('index-editor').innerHTML = (indices || []).map((v, i) =>
    `<input type="number" min="0" max="99" step="1" value="${v}" data-pos="${i}" title="indices[${i}]">`).join('');
  for (const input of el('index-editor').querySelectorAll('input')) {
    input.addEventListener('input', () => { readControls(); update(); });
  }
}

// Controls → state.
function readControls() {
  for (const name of ATTRIBUTE_NAMES) {
    const a = attributes[name];
    a.enabled = el(name + '-enabled').checked;
    a.buffer = Number(el(name + '-buffer').value);
    a.size = Number(el(name + '-size').value);
    a.stride = readInt(name + '-stride');
    a.offset = readInt(name + '-offset');
  }
  draw.kind = el('kind-elements').checked ? 'elements' : 'arrays';
  draw.first = readInt('arrays-first');
  draw.count = readInt('arrays-count');
  draw.elementCount = readInt('elements-count');
  draw.elementOffset = readInt('elements-offset');
  if (indices) {
    for (const input of el('index-editor').querySelectorAll('input')) {
      const n = parseInt(input.value, 10);
      indices[Number(input.dataset.pos)] = isNaN(n) || n < 0 ? 0 : Math.min(n, 65535);
    }
  }
}

// Small hints under the controls, and which draw controls are visible.
function updateHints() {
  for (const name of ATTRIBUTE_NAMES) {
    const a = attributes[name];
    el(name + '-hint').textContent = !a.enabled ? 'Disabled: uses the constant value.'
      : `Reads ${a.size} float${a.size > 1 ? 's' : ''} = ${a.size * 4} bytes per vertex, every ${effectiveStride(a)} bytes` +
        (a.stride === 0 ? ' (stride 0 = tightly packed).' : '.');
  }
  el('arrays-controls').style.display = draw.kind === 'arrays' ? '' : 'none';
  el('elements-controls').style.display = draw.kind === 'elements' ? '' : 'none';
  el('draw-hint').textContent = draw.kind === 'arrays'
    ? `Uses vertices ${draw.first} to ${draw.first + draw.count - 1}, in order.`
    : 'offset is in bytes into the index buffer; each index is 2 bytes (UNSIGNED_SHORT).';
}

// Redo everything: simulate, run real WebGL, redraw every view.
function update() {
  sequence = drawSequence();
  inputs = sequence.map(s => ({ aPosition: readAttribute('aPosition', s.vertex), aColor: readAttribute('aColor', s.vertex) }));
  step = Math.max(0, Math.min(step, sequence.length - 1));

  updateHints();
  const lines = runCalls();
  drawMemory();
  renderStepExplain();
  drawOverlay();
  renderDrawReport(lines);
  renderInputs();
  renderState();
  renderCode(lines);
  el('step-label').textContent = sequence.length
    ? `Step ${step} of ${sequence.length} (vertex ${sequence[step].vertex === null ? '—' : sequence[step].vertex})`
    : 'No vertices to step through.';
}

// ---- Wire up the controls. ----
el('preset').innerHTML = PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
el('preset').addEventListener('change', () => {
  loadPreset(Number(el('preset').value));
  syncControls();
  update();
});

// Every other control: read them all, then redo everything.
for (const input of el('panel').querySelectorAll('fieldset input, fieldset select')) {
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
el('step-next').addEventListener('click', () => { step = Math.min(sequence.length - 1, step + 1); update(); });
el('show-all').addEventListener('change', () => { showAll = el('show-all').checked; drawMemory(); });

window.addEventListener('resize', drawMemory);

// ---- Start. ----
if (!gl) {
  document.getElementById('main').innerHTML = '<section><p class="bad">This browser does not support WebGL 2, which this tool needs.</p></section>';
} else {
  loadPreset(0);
  syncControls();
  update();
}
