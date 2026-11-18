// =============================================================================
// index.js — Six ways to draw triangles from a buffer in WebGL 2.
//
// THE BIG IDEA
// ------------
// A draw call does two things:
//   1. It makes a list of vertex numbers.
//        drawArrays(mode, first, count):        first, first+1, …, first+count−1
//        drawElements(mode, count, type, offset): the numbers stored in the
//                                                 index buffer
//   2. It groups that list into triangles. The MODE says how:
//        TRIANGLES:       every 3 in a row make one triangle      (n / 3 triangles)
//        TRIANGLE_STRIP:  each new vertex + the 2 before it       (n − 2 triangles)
//        TRIANGLE_FAN:    the first vertex + each new pair        (n − 2 triangles)
// For each vertex number in the list, the vertex shader reads that vertex's
// attribute values from the vertex buffer.
//
// HOW THIS PAGE WORKS
// -------------------
// Section 1 holds six functions, one per case. Each one is the complete set
// of calls for its case. The page shows each function's own source text
// (fn.toString()), so the code on screen is exactly the code that runs.
// Each case draws into its own canvas with real WebGL 2.
//
// While a case runs, the page watches its WebGL calls (section 2) to learn
// what went into the buffers and which draw call was made. The pictures
// are drawn from that record, so they always match the code.
//
// FILE OUTLINE
//   Section 1. The six cases: the code that runs.
//   Section 2. Real WebGL 2: shaders, and running a case while watching it.
//   Section 3. Our copy of the draw call's rules: vertex list → triangles.
//   Section 4. The result view: the outline drawn over the WebGL canvas.
//   Section 5. The clip-space view (SVG).
//   Section 6. The buffer view (SVG).
//   Section 7. The page: building each case, tabs, hover, summary table.
// =============================================================================


// -----------------------------------------------------------------------------
// Section 1. The six cases: the code that runs.
// -----------------------------------------------------------------------------
// Every case draws the same kind of shape as the other case in its column:
//   - TRIANGLES and TRIANGLE_STRIP draw the same band of 3 triangles:
//
//         T0 ------ T1 ------ T2        top row:    y =  0.4
//           \      /  \      /
//            \    /    \    /
//             B0 -------- B1             bottom row: y = -0.4
//
//   - TRIANGLE_FAN draws 4 triangles around a center point.
// Positions are in clip space, where the visible area runs from -1 to 1 in
// x and y. All triangles are counterclockwise (the usual front-face winding).
//
// Each function receives the WebGL context and a shader program that is
// already in use (section 2). The only attribute is aPosition (x, y).

function drawArraysTriangles(gl, program) {
  // 9 vertices, 3 per triangle. A corner shared by two or three
  // triangles is stored again for each one.
  const positions = new Float32Array([
    // triangle 0
    -0.8,  0.4,   // vertex 0
    -0.4, -0.4,   // vertex 1
     0.0,  0.4,   // vertex 2
    // triangle 1
     0.0,  0.4,   // vertex 3 (same corner as vertex 2)
    -0.4, -0.4,   // vertex 4 (same corner as vertex 1)
     0.4, -0.4,   // vertex 5
    // triangle 2
     0.0,  0.4,   // vertex 6 (same corner as vertices 2 and 3)
     0.4, -0.4,   // vertex 7 (same corner as vertex 5)
     0.8,  0.4,   // vertex 8
  ]);

  // Copy the positions into a vertex buffer on the GPU.
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  // aPosition reads 2 floats per vertex from that buffer.
  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  // Vertices 0 to 8, in groups of 3: 0-1-2, 3-4-5, 6-7-8.
  gl.drawArrays(gl.TRIANGLES, 0, 9);
}

function drawArraysStrip(gl, program) {
  // 5 vertices, stored in zigzag order: top, bottom, top, bottom, top.
  const positions = new Float32Array([
    -0.8,  0.4,   // vertex 0 (T0)
    -0.4, -0.4,   // vertex 1 (B0)
     0.0,  0.4,   // vertex 2 (T1)
     0.4, -0.4,   // vertex 3 (B1)
     0.8,  0.4,   // vertex 4 (T2)
  ]);

  // Copy the positions into a vertex buffer on the GPU.
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  // aPosition reads 2 floats per vertex from that buffer.
  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  // Vertices 0 to 4. Each vertex after the first two makes a triangle
  // with the two before it: 0-1-2, 2-1-3, 2-3-4 (5 vertices → 3 triangles).
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 5);
}

function drawArraysFan(gl, program) {
  // 6 vertices: the center first, then the rim from right to left
  // (counterclockwise around the center).
  const positions = new Float32Array([
     0.0, -0.3,   // vertex 0 (the center)
     0.8, -0.3,   // vertex 1
     0.6,  0.3,   // vertex 2
     0.0,  0.5,   // vertex 3
    -0.6,  0.3,   // vertex 4
    -0.8, -0.3,   // vertex 5
  ]);

  // Copy the positions into a vertex buffer on the GPU.
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  // aPosition reads 2 floats per vertex from that buffer.
  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  // Vertices 0 to 5. Every triangle uses vertex 0, plus each new vertex
  // and the one before it: 0-1-2, 0-2-3, 0-3-4, 0-4-5 (6 → 4 triangles).
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 6);
}

function drawElementsTriangles(gl, program) {
  // 5 vertices, each corner stored once, in row order:
  // top row left to right, then bottom row left to right.
  const positions = new Float32Array([
    -0.8,  0.4,   // vertex 0 (T0)
     0.0,  0.4,   // vertex 1 (T1)
     0.8,  0.4,   // vertex 2 (T2)
    -0.4, -0.4,   // vertex 3 (B0)
     0.4, -0.4,   // vertex 4 (B1)
  ]);

  // 9 indices, 3 per triangle. Each index is a vertex number.
  const indices = new Uint16Array([
    0, 3, 1,   // triangle 0
    1, 3, 4,   // triangle 1
    1, 4, 2,   // triangle 2
  ]);

  // Copy the positions into a vertex buffer on the GPU.
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  // Copy the indices into an index buffer.
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  // aPosition reads 2 floats per vertex from the vertex buffer.
  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  // 9 indices of type UNSIGNED_SHORT (Uint16), starting at byte 0 of
  // the index buffer, in groups of 3.
  gl.drawElements(gl.TRIANGLES, 9, gl.UNSIGNED_SHORT, 0);
}

function drawElementsStrip(gl, program) {
  // The same 5 vertices as the indexed TRIANGLES case, in row order.
  const positions = new Float32Array([
    -0.8,  0.4,   // vertex 0 (T0)
     0.0,  0.4,   // vertex 1 (T1)
     0.8,  0.4,   // vertex 2 (T2)
    -0.4, -0.4,   // vertex 3 (B0)
     0.4, -0.4,   // vertex 4 (B1)
  ]);

  // 5 indices that visit the vertices in zigzag order:
  // T0, B0, T1, B1, T2.
  const indices = new Uint16Array([0, 3, 1, 4, 2]);

  // Copy the positions into a vertex buffer on the GPU.
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  // Copy the indices into an index buffer.
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  // aPosition reads 2 floats per vertex from the vertex buffer.
  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  // 5 indices, starting at byte 0. The strip rule is applied to the
  // INDEX list: indices[0..2], then [1..3], then [2..4].
  gl.drawElements(gl.TRIANGLE_STRIP, 5, gl.UNSIGNED_SHORT, 0);
}

function drawElementsFan(gl, program) {
  // 6 vertices: the rim from right to left, then the center LAST.
  const positions = new Float32Array([
     0.8, -0.3,   // vertex 0
     0.6,  0.3,   // vertex 1
     0.0,  0.5,   // vertex 2
    -0.6,  0.3,   // vertex 3
    -0.8, -0.3,   // vertex 4
     0.0, -0.3,   // vertex 5 (the center)
  ]);

  // A fan needs the center first, so the index list starts with 5.
  const indices = new Uint16Array([5, 0, 1, 2, 3, 4]);

  // Copy the positions into a vertex buffer on the GPU.
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  // Copy the indices into an index buffer.
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  // aPosition reads 2 floats per vertex from the vertex buffer.
  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  // 6 indices, starting at byte 0. Every triangle uses indices[0]
  // (vertex 5, the center), plus each new index and the one before it.
  gl.drawElements(gl.TRIANGLE_FAN, 6, gl.UNSIGNED_SHORT, 0);
}

// The six cases, in tab order. `explain` is the text above each case.
const CASES = [
  {
    id: 'arrays-triangles', call: 'drawArrays', mode: 'TRIANGLES', run: drawArraysTriangles,
    explain: `Every 3 vertices in a row make one triangle: 0-1-2, 3-4-5, 6-7-8.
      A corner shared by several triangles is stored again for each one, so
      this band of 3 triangles needs 9 vertices for its 5 corners. The corner
      at (0, 0.4) is stored 3 times.`,
  },
  {
    id: 'arrays-strip', call: 'drawArrays', mode: 'TRIANGLE_STRIP', run: drawArraysStrip,
    explain: `The first 3 vertices make a triangle. After that, each new vertex
      makes a triangle with the 2 before it, so n vertices make n − 2
      triangles, and the same band needs only 5 vertices. They must be
      stored in zigzag order. Triangle 1 is 2-1-3, not 1-2-3: WebGL swaps the
      first two vertices of every other triangle so that all the triangles
      keep the same winding (here, all counterclockwise). Winding matters
      once face culling is turned on.`,
  },
  {
    id: 'arrays-fan', call: 'drawArrays', mode: 'TRIANGLE_FAN', run: drawArraysFan,
    explain: `Vertex 0 is in every triangle. Each new vertex makes a triangle
      with vertex 0 and the vertex before it: 0-1-2, 0-2-3, 0-3-4, 0-4-5.
      n vertices make n − 2 triangles. A fan suits any shape whose
      triangles all share one point, such as a disc or a convex polygon.`,
  },
  {
    id: 'elements-triangles', call: 'drawElements', mode: 'TRIANGLES', run: drawElementsTriangles,
    explain: `Each corner is stored once (5 vertices), in any order we like:
      here the top row, then the bottom row. The index buffer lists 3 vertex
      numbers per triangle. A shared corner is now repeated as a 2-byte
      index instead of a whole vertex (8 bytes here; more when vertices also
      have colors or normals). The grouping rule is the same as with
      drawArrays, applied to the index list.`,
  },
  {
    id: 'elements-strip', call: 'drawElements', mode: 'TRIANGLE_STRIP', run: drawElementsStrip,
    explain: `The same 5 vertices as the indexed TRIANGLES case, in the same
      row order. The strip rule is applied to the index list, not to the
      vertex buffer: the indices 0, 3, 1, 4, 2 visit the corners in zigzag
      order. Compare the triangles with the indexed TRIANGLES case: they are
      the same, from 5 indices instead of 9.`,
  },
  {
    id: 'elements-fan', call: 'drawElements', mode: 'TRIANGLE_FAN', run: drawElementsFan,
    explain: `Here the center is stored last (vertex 5). The fan rule needs
      the shared point first in the list, so the index list starts with 5.
      With drawElements the order in the vertex buffer does not matter; the
      order in the index buffer does.`,
  },
];


// -----------------------------------------------------------------------------
// Section 2. Real WebGL 2: shaders, and running a case while watching it.
// -----------------------------------------------------------------------------
// The shaders are as small as possible: the vertex shader passes the
// position through as clip space, and every fragment is the same light
// blue. (The triangle outlines on the result are drawn by the page, on a
// 2D canvas over the WebGL canvas; see section 4.)
//
// The shaders are JavaScript template strings. The two markers before each
// one (`// language=GLSL` for JetBrains IDEs, `/* glsl */` for VS Code)
// only turn on GLSL syntax highlighting in the editor; they change nothing
// when the page runs. `#version 300 es` must be the very first line of a
// WebGL 2 shader, so it goes right after the backtick.

// language=GLSL
const vertexShaderSource = /* glsl */ `#version 300 es
// One attribute: the vertex's (x, y) position, already in clip space.
in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// language=GLSL
const fragmentShaderSource = /* glsl */ `#version 300 es
precision mediump float;
out vec4 outColor;

void main() {
  outColor = vec4(0.62, 0.79, 0.96, 1.0);   // light blue
}`;

const RESULT_SIZE = 260;   // CSS pixels, width and height of each result canvas

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  return program;
}

// Returns a stand-in for `gl` that behaves exactly like it, but also notes
// the data given to bufferData and the arguments of the draw call in
// `record`. (A Proxy passes every property and method through to the real
// context; we only look at the arguments on the way.) Each case uses one
// vertex buffer and at most one index buffer, so one slot each is enough.
function watchCalls(gl, record) {
  return new Proxy(gl, {
    get(target, name) {
      const value = target[name];
      if (typeof value !== 'function') return value;   // constants such as gl.TRIANGLES
      return function (...args) {
        if (name === 'bufferData' && args[0] === target.ARRAY_BUFFER) record.positions = args[1];
        if (name === 'bufferData' && args[0] === target.ELEMENT_ARRAY_BUFFER) record.indices = args[1];
        if (name === 'drawArrays') {
          record.draw = { call: 'drawArrays', mode: args[0], first: args[1], count: args[2] };
        }
        if (name === 'drawElements') {
          record.draw = { call: 'drawElements', mode: args[0], count: args[1], type: args[2], offset: args[3] };
        }
        return value.apply(target, args);
      };
    },
  });
}

// Each case gets its own canvas and its own WebGL context, so no case can
// leave buffers or settings behind for another. Returns the record of what
// the case did, plus any WebGL error.
function runCase(c, canvas) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(RESULT_SIZE * dpr);   // drawing-buffer size = CSS size × dpr
  canvas.height = Math.round(RESULT_SIZE * dpr);

  const gl = canvas.getContext('webgl2');
  if (!gl) return { failed: 'This browser does not support WebGL 2.' };

  const program = createProgram(gl);
  gl.useProgram(program);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(1, 1, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const record = { positions: null, indices: null, draw: null };
  c.run(watchCalls(gl, record), program);

  const error = gl.getError();
  record.error = error === gl.NO_ERROR ? null : errorName(gl, error);
  return record;
}

function errorName(gl, code) {
  for (const name of ['INVALID_ENUM', 'INVALID_VALUE', 'INVALID_OPERATION', 'OUT_OF_MEMORY']) {
    if (gl[name] === code) return name;
  }
  return 'error ' + code;
}


// -----------------------------------------------------------------------------
// Section 3. Our copy of the draw call's rules: vertex list → triangles.
// -----------------------------------------------------------------------------
// The GPU does not tell us how it grouped the vertices, so these functions
// apply the same rules in JavaScript to the recorded draw call. The
// pictures in sections 4–6 are drawn from the result.

const MODE_NAMES = { 4: 'TRIANGLES', 5: 'TRIANGLE_STRIP', 6: 'TRIANGLE_FAN' };

// Step 1: the list of vertex numbers the draw call makes.
function vertexList(record) {
  const d = record.draw;
  if (d.call === 'drawArrays') {
    return Array.from({ length: d.count }, (_, i) => d.first + i);
  }
  // drawElements: `offset` is in BYTES, and each UNSIGNED_SHORT index is
  // 2 bytes, so the first index used is indices[offset / 2].
  const start = d.offset / 2;
  return Array.from(record.indices.slice(start, start + d.count));
}

// Step 2: group the list into triangles. Each triangle is given as three
// PLACES in the list (0 = the list's first entry), in the order the
// triangle uses them. The buffer picture marks these places.
function assemble(modeName, n) {
  const triangles = [];
  if (modeName === 'TRIANGLES') {
    for (let i = 0; i + 2 < n; i += 3) triangles.push([i, i + 1, i + 2]);
  } else if (modeName === 'TRIANGLE_STRIP') {
    // Every other triangle has its first two vertices swapped, so all the
    // triangles keep the same winding. (Some specs write the odd triangle
    // as i, i+2, i+1 instead; that is the same triangle with the same
    // winding, starting at a different vertex.)
    for (let i = 0; i + 2 < n; i++) {
      triangles.push(i % 2 === 0 ? [i, i + 1, i + 2] : [i + 1, i, i + 2]);
    }
  } else if (modeName === 'TRIANGLE_FAN') {
    for (let i = 1; i + 1 < n; i++) triangles.push([0, i, i + 1]);
  }
  return triangles;
}

// Everything the pictures need about one case, built from its record.
function describe(record) {
  const positions = [];
  for (let k = 0; k + 1 < record.positions.length; k += 2) {
    positions.push([record.positions[k], record.positions[k + 1]]);
  }
  const list = vertexList(record);
  const modeName = MODE_NAMES[record.draw.mode];
  const triangles = assemble(modeName, list.length).map(places => ({
    places,                                  // places in the list
    vertices: places.map(p => list[p]),      // vertex numbers
  }));
  return { indexed: record.draw.call === 'drawElements', modeName, positions, list, triangles };
}

// Which triangles use vertex number v / list place p. Used to tag picture
// parts for highlighting, as a space-separated string such as "0 1".
function trianglesUsingVertex(model, v) {
  return model.triangles.map((t, i) => (t.vertices.includes(v) ? i : -1)).filter(i => i >= 0).join(' ');
}
function trianglesUsingPlace(model, p) {
  return model.triangles.map((t, i) => (t.places.includes(p) ? i : -1)).filter(i => i >= 0).join(' ');
}

// Numbers as short text: 0.4000000059604645 (a float32) → "0.4".
function fmt(v) {
  return String(Number(v.toFixed(2)));
}


// -----------------------------------------------------------------------------
// Section 4. The result view: the outline drawn over the WebGL canvas.
// -----------------------------------------------------------------------------
// WebGL fills every triangle with the same color, so neighboring triangles
// would merge into one shape. A transparent 2D canvas on top draws each
// triangle's edges, and the hovered triangle in yellow.

// Clip space (-1..1, y up) → CSS pixels on a size × size canvas (y down).
function clipToPixel(x, y, size) {
  return [(x + 1) / 2 * size, (1 - y) / 2 * size];
}

function drawOverlay(c) {
  const canvas = c.overlay;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(RESULT_SIZE * dpr);
  canvas.height = Math.round(RESULT_SIZE * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // draw in CSS pixels
  ctx.clearRect(0, 0, RESULT_SIZE, RESULT_SIZE);
  if (!c.model) return;

  c.model.triangles.forEach((t, i) => {
    const pts = t.vertices.map(v => clipToPixel(...c.model.positions[v], RESULT_SIZE));
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    ctx.lineTo(...pts[1]);
    ctx.lineTo(...pts[2]);
    ctx.closePath();
    if (i === c.hover) {
      ctx.fillStyle = 'rgba(255, 210, 60, 0.75)';
      ctx.fill();
    }
    ctx.strokeStyle = '#1f5fbf';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

// Which triangle is under the point (x, y) in clip space, or null. Uses the
// sign of three cross products: inside means on the same side of all edges.
function triangleAt(model, x, y) {
  for (let i = model.triangles.length - 1; i >= 0; i--) {
    const [a, b, d] = model.triangles[i].vertices.map(v => model.positions[v]);
    const s1 = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    const s2 = (d[0] - b[0]) * (y - b[1]) - (d[1] - b[1]) * (x - b[0]);
    const s3 = (a[0] - d[0]) * (y - d[1]) - (a[1] - d[1]) * (x - d[0]);
    if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) return i;
  }
  return null;
}


// -----------------------------------------------------------------------------
// Section 5. The clip-space view (SVG).
// -----------------------------------------------------------------------------
// The vertices on clip-space axes, each labeled with its vertex number(s)
// and coordinates, and each triangle outlined and numbered.
//
// Picture parts that belong to triangles get class "hl" and a data-tris
// attribute listing those triangles; section 7 highlights them on hover.
// Parts the mouse can point at to choose a triangle get data-tri.

const COORDS_W = 340, COORDS_H = 300;
const COORDS_CX = 175, COORDS_CY = 145, COORDS_SCALE = 120;   // 1 clip-space unit = 120 px

function coordsSvg(model) {
  const px = x => COORDS_CX + x * COORDS_SCALE;
  const py = y => COORDS_CY - y * COORDS_SCALE;
  let s = '';

  // Grid every 0.2, axes, and labels at -1, 0, 1 along the bottom and
  // left edges (away from the vertex labels).
  for (let k = -5; k <= 5; k++) {
    const v = k / 5;
    const cls = k === 0 ? 'axis' : 'grid';
    s += `<line class="${cls}" x1="${px(v)}" y1="${py(-1)}" x2="${px(v)}" y2="${py(1)}"/>`;
    s += `<line class="${cls}" x1="${px(-1)}" y1="${py(v)}" x2="${px(1)}" y2="${py(v)}"/>`;
  }
  for (const v of [-1, 0, 1]) {
    s += `<text class="tick" x="${px(v)}" y="${py(-1) + 11}" text-anchor="middle">${v}</text>`;
    s += `<text class="tick" x="${px(-1) - 4}" y="${py(v) + 3}" text-anchor="end">${v}</text>`;
  }
  s += `<text class="tick" x="${px(1) - 2}" y="${py(0) - 4}" text-anchor="end">x</text>`;
  s += `<text class="tick" x="${px(0) + 4}" y="${py(1) + 8}">y</text>`;

  // Triangles, numbered at their centroids (the average of the 3 corners).
  model.triangles.forEach((t, i) => {
    const pts = t.vertices.map(v => model.positions[v]);
    const points = pts.map(p => `${px(p[0])},${py(p[1])}`).join(' ');
    s += `<polygon class="tri hl" data-tri="${i}" data-tris="${i}" points="${points}"/>`;
    const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
    const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
    s += `<text class="tri-num" x="${px(cx)}" y="${py(cy) + 4}" text-anchor="middle">${i}</text>`;
  });

  // Vertices. With drawArrays(TRIANGLES) several vertices sit on the same
  // corner, so vertices are grouped by position and labeled together.
  const groups = new Map();   // "x,y" → vertex numbers at that position
  model.positions.forEach((p, v) => {
    const key = `${fmt(p[0])},${fmt(p[1])}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(v);
  });
  // Labels go outward from the middle of the shape so they don't cover it.
  const mid = [0, 1].map(k => model.positions.reduce((sum, p) => sum + p[k], 0) / model.positions.length);
  for (const [key, verts] of groups) {
    const [x, y] = model.positions[verts[0]];
    const tris = [...new Set(verts.flatMap(v => trianglesUsingVertex(model, v).split(' ')))].join(' ');
    s += `<circle class="dot hl" data-tris="${tris}" cx="${px(x)}" cy="${py(y)}" r="4"/>`;
    const below = y < mid[1];
    const dx = Math.sign(x - mid[0]) * 8;
    const ty = below ? py(y) + 16 : py(y) - 18;
    const anchor = dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle';
    s += `<text class="vlabel" x="${px(x) + dx}" y="${ty}" text-anchor="${anchor}">`
       + `${verts.map(v => 'v' + v).join(', ')}</text>`;
    s += `<text class="vcoord" x="${px(x) + dx}" y="${ty + 11}" text-anchor="${anchor}">(${key.replace(',', ', ')})</text>`;
  }

  return `<svg viewBox="0 0 ${COORDS_W} ${COORDS_H}" width="${COORDS_W}" height="${COORDS_H}"
    role="img" aria-label="The vertices and triangles in clip space">${s}</svg>`;
}


// -----------------------------------------------------------------------------
// Section 6. The buffer view (SVG).
// -----------------------------------------------------------------------------
// Top to bottom:
//   - drawElements only: the vertex buffer, one box per vertex (x, y), with
//     a line from each index box up to the vertex it names.
//   - The LIST the draw call makes: for drawArrays, the vertex buffer itself
//     (read in order); for drawElements, the index buffer.
//   - One row per triangle, with a dot under each list entry it uses. The
//     number in the dot is the order (1st, 2nd, 3rd corner), which shows
//     the swapped order of every other triangle in a strip.

const LABEL_W = 112;   // left column for row labels
const CELL = 58;       // horizontal space per box
const BOX_W = 52, BOX_H = 44, INDEX_H = 34;
const LINK_GAP = 46;   // space for the lines from index boxes to vertex boxes
const ROW_H = 24;      // one triangle row

function vertexBox(model, v, x, y, tris) {
  const [vx, vy] = model.positions[v];
  return `<g class="box hl" data-tris="${tris}">`
    + `<rect x="${x}" y="${y}" width="${BOX_W}" height="${BOX_H}" rx="3"/>`
    + `<text class="box-head" x="${x + BOX_W / 2}" y="${y + 11}" text-anchor="middle">vertex ${v}</text>`
    + `<text class="box-val" x="${x + 6}" y="${y + 25}">x ${fmt(vx)}</text>`
    + `<text class="box-val" x="${x + 6}" y="${y + 38}">y ${fmt(vy)}</text></g>`;
}

function buffersSvg(model) {
  const n = model.list.length;
  const columns = Math.max(n, model.positions.length);
  const width = LABEL_W + columns * CELL + 150;
  const colX = i => LABEL_W + i * CELL;            // left edge of box i
  const colMid = i => colX(i) + BOX_W / 2;         // its center
  let s = '';
  let y = 4;

  if (model.indexed) {
    // The vertex buffer, then the index buffer, linked by lines.
    s += `<text class="row-label" x="0" y="${y + 20}">vertex buffer</text>`;
    s += `<text class="row-note" x="0" y="${y + 33}">2 floats per vertex</text>`;
    model.positions.forEach((_, v) => { s += vertexBox(model, v, colX(v), y, trianglesUsingVertex(model, v)); });
    const vertexBottom = y + BOX_H;
    y += BOX_H + LINK_GAP;

    model.list.forEach((v, p) => {
      s += `<line class="link hl" data-tris="${trianglesUsingPlace(model, p)}"
        x1="${colMid(p)}" y1="${y}" x2="${colMid(v)}" y2="${vertexBottom}"/>`;
    });
    s += `<text class="row-label" x="0" y="${y + 15}">index buffer</text>`;
    s += `<text class="row-note" x="0" y="${y + 28}">Uint16, 2 bytes each</text>`;
    model.list.forEach((v, p) => {
      s += `<g class="box hl" data-tris="${trianglesUsingPlace(model, p)}">`
        + `<rect x="${colX(p)}" y="${y}" width="${BOX_W}" height="${INDEX_H}" rx="3"/>`
        + `<text class="box-head" x="${colMid(p)}" y="${y + 11}" text-anchor="middle">indices[${p}]</text>`
        + `<text class="box-big" x="${colMid(p)}" y="${y + 28}" text-anchor="middle">${v}</text></g>`;
    });
    y += INDEX_H;
  } else {
    // drawArrays: the vertex buffer is the list, read in order.
    s += `<text class="row-label" x="0" y="${y + 20}">vertex buffer</text>`;
    s += `<text class="row-note" x="0" y="${y + 33}">read in order →</text>`;
    model.list.forEach((v, p) => { s += vertexBox(model, v, colX(p), y, trianglesUsingPlace(model, p)); });
    y += BOX_H;
  }

  // One row per triangle.
  y += 12;
  model.triangles.forEach((t, i) => {
    const cy = y + ROW_H / 2;
    const xs = t.places.map(colMid);
    s += `<g class="trirow hl" data-tri="${i}" data-tris="${i}">`
      + `<rect x="0" y="${y}" width="${width}" height="${ROW_H}" rx="3"/>`
      + `<text class="row-label" x="6" y="${cy + 4}">triangle ${i}</text>`
      + `<line class="span" x1="${Math.min(...xs)}" y1="${cy}" x2="${Math.max(...xs)}" y2="${cy}"/>`;
    t.places.forEach((p, k) => {
      s += `<circle class="use" cx="${colMid(p)}" cy="${cy}" r="8"/>`
        + `<text class="use-num" x="${colMid(p)}" y="${cy + 4}" text-anchor="middle">${k + 1}</text>`;
    });
    s += `<text class="tri-verts" x="${colX(columns) + 4}" y="${cy + 4}">= vertices ${t.vertices.join(', ')}</text></g>`;
    y += ROW_H + 2;
  });

  return `<svg viewBox="0 0 ${width} ${y + 2}" width="${width}" height="${y + 2}"
    role="img" aria-label="The buffers, and which entries each triangle uses">${s}</svg>`;
}


// -----------------------------------------------------------------------------
// Section 7. The page: building each case, tabs, hover, summary table.
// -----------------------------------------------------------------------------

// The function's source as HTML: comments in gray, the draw call in bold.
function codeHtml(fn) {
  const escape = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return fn.toString().split('\n').map(line => {
    const at = line.indexOf('//');   // our cases have no "//" inside strings
    const code = at < 0 ? line : line.slice(0, at);
    const comment = at < 0 ? '' : `<span class="comment">${escape(line.slice(at))}</span>`;
    const html = escape(code) + comment;
    return /gl\.draw(Arrays|Elements)\(/.test(line) ? `<span class="draw-line">${html}</span>` : html;
  }).join('\n');
}

function buildCase(c) {
  const section = document.createElement('section');
  section.className = 'case';
  section.id = 'case-' + c.id;   // not c.id itself, so the #address doesn't scroll the page
  section.innerHTML = `
    <h2><code>gl.${c.call}(gl.${c.mode}, …)</code></h2>
    <p class="explain">${c.explain}</p>
    <div class="case-grid">
      <div class="panel code-panel">
        <h3>The code</h3>
        <pre class="code"></pre>
        <p class="hint">Runs after the shared setup: getting the WebGL 2 context and
          compiling the shaders (<code>index.js</code>, section 2).</p>
      </div>
      <div class="panel">
        <h3>What WebGL draws</h3>
        <div class="result-wrap"><canvas class="gl"></canvas><canvas class="overlay"></canvas></div>
        <p class="report"></p>
      </div>
      <div class="panel">
        <h3>The vertices in clip space</h3>
        <div class="coords"></div>
      </div>
      <div class="panel buffers-panel">
        <h3>The buffers, and how the draw call groups them into triangles</h3>
        <div class="buffers"></div>
        <p class="hint">Point at a triangle (here, in the clip-space view, or on the
          result) to see which entries it uses.</p>
      </div>
    </div>`;
  document.getElementById('cases').appendChild(section);

  c.section = section;
  c.overlay = section.querySelector('.overlay');
  c.hover = null;
  section.querySelector('.code').innerHTML = codeHtml(c.run);

  const report = section.querySelector('.report');
  let record;
  try {
    record = runCase(c, section.querySelector('.gl'));
  } catch (e) {
    record = { failed: e.message };
  }
  if (record.failed) {
    report.innerHTML = `<span class="bad">${record.failed}</span>`;
    return;
  }
  c.record = record;
  c.model = describe(record);
  const m = c.model;
  report.innerHTML = (record.error
      ? `<span class="bad">WebGL error: ${record.error}</span>`
      : '<span class="ok">No WebGL errors.</span>')
    + ` ${m.triangles.length} triangles from ${m.list.length} `
    + (m.indexed ? `indices (${m.positions.length} vertices stored).` : 'vertices.')
    + ' The outlines are drawn by the page, not by WebGL.';

  section.querySelector('.coords').innerHTML = coordsSvg(m);
  section.querySelector('.buffers').innerHTML = buffersSvg(m);
  drawOverlay(c);

  // Hover: in the pictures, anything inside an element with data-tri
  // chooses that triangle; on the result, the triangle under the mouse.
  for (const svgHost of section.querySelectorAll('.coords, .buffers')) {
    svgHost.addEventListener('mousemove', e => {
      const hit = e.target.closest('[data-tri]');
      setHover(c, hit ? Number(hit.dataset.tri) : null);
    });
    svgHost.addEventListener('mouseleave', () => setHover(c, null));
  }
  c.overlay.addEventListener('mousemove', e => {
    const r = c.overlay.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 2 - 1;   // CSS pixels → clip space
    const y = 1 - (e.clientY - r.top) / r.height * 2;
    setHover(c, triangleAt(m, x, y));
  });
  c.overlay.addEventListener('mouseleave', () => setHover(c, null));
}

// Highlight triangle t (or nothing, for null) in all three views of case c.
function setHover(c, t) {
  if (c.hover === t) return;
  c.hover = t;
  for (const el of c.section.querySelectorAll('.hl')) {
    el.classList.toggle('hot', t !== null && el.dataset.tris.split(' ').includes(String(t)));
  }
  drawOverlay(c);
}

// The summary table: what each case stores, side by side.
function buildSummary() {
  const rows = CASES.filter(c => c.model).map(c => {
    const m = c.model;
    const vertexBytes = c.record.positions.byteLength;
    const indexBytes = c.record.indices ? c.record.indices.byteLength : 0;
    return `<tr data-case="${c.id}">
      <td><code>${c.call}</code></td><td><code>${c.mode}</code></td>
      <td>${m.positions.length}</td><td>${m.indexed ? m.list.length : '–'}</td>
      <td>${m.triangles.length}</td>
      <td>${vertexBytes}${indexBytes ? ` + ${indexBytes}` : ''} = ${vertexBytes + indexBytes}</td></tr>`;
  }).join('');
  const table = document.getElementById('summary');
  table.innerHTML = `<tr><th>Draw call</th><th>Mode</th><th>Vertices stored</th>
    <th>Indices</th><th>Triangles</th><th>Bytes (vertex + index buffers)</th></tr>${rows}`;
  for (const tr of table.querySelectorAll('tr[data-case]')) {
    tr.addEventListener('click', () => select(tr.dataset.case));
  }
}

// Tabs: one case at a time, or all of them with "Show all". The chosen
// case is kept in the address (#elements-strip), so a link can open it.
function select(id) {
  if (!CASES.some(c => c.id === id)) id = CASES[0].id;
  history.replaceState(null, '', '#' + id);
  for (const c of CASES) {
    c.section.classList.toggle('chosen', c.id === id);
    document.querySelector(`#tabs button[data-case="${c.id}"]`).classList.toggle('chosen', c.id === id);
  }
  for (const tr of document.querySelectorAll('#summary tr[data-case]')) {
    tr.classList.toggle('chosen', tr.dataset.case === id);
  }
  if (document.body.classList.contains('show-all')) {
    CASES.find(c => c.id === id).section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function buildTabs() {
  for (const button of document.querySelectorAll('#tabs button')) {
    button.addEventListener('click', () => select(button.dataset.case));
  }
  const showAll = document.getElementById('show-all');
  showAll.addEventListener('change', () => {
    document.body.classList.toggle('show-all', showAll.checked);
  });
}

CASES.forEach(buildCase);
buildSummary();
buildTabs();
select(location.hash.slice(1));
