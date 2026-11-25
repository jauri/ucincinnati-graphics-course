// =====================================================================
//  Cube color code explorer
// =====================================================================
//
// A code explorer for two programs of "Ways to Color a Cube"
// (webGL-examples/examples/cube-color-alternatives/):
//   tab 5  5-custom-interpolation.js  the fragment shader interpolates
//                                     the colors itself, with one rule
//                                     chosen by uniform int uMode
//   tab 6  6-per-triangle-rules.js    the same, but even and odd
//                                     triangles get their own rule,
//                                     found with gl_VertexID
// The switch at the top of the page loads index.html?tab=5 or ?tab=6;
// without ?tab, tab 5 is shown.
//
// The page shows that program's whole source on the left and draws the
// same cube with the SAME shaders on the right. Then it links the two:
//
//   - Click the cube: we work out, in JavaScript, everything the GPU did
//     for the fragment under the mouse (triangle number, barycentric
//     coordinates, flat colors, the interpolation rule, the lighting).
//     The trace lists each step next to the line of code that does it,
//     and the code panel marks those lines. Finally we read back the
//     pixel WebGL really drew and compare.
//
//   - Click an underlined line of code: the cube gets an overlay that
//     shows what that line means (the barycentric coordinates of a
//     triangle's vertices, the three colors every vertex carries, and
//     in tab 6 also triangle numbers and even/odd triangles).
//
// tab5-source.js and tab6-source.js (loaded first) hold the two programs'
// text as TAB5_SOURCE_LINES and TAB6_SOURCE_LINES, one string per line.
// They are generated copies; see this folder's CLAUDE.md for how to
// refresh them.
//
// Sections:
//   1. Reading the tab's source (find lines, sections, the two shaders)
//   2. The cube's data (copied from tabs 5/6, section 2)
//   3. Matrix helpers (copied from tabs 5/6, section 3, plus two small ones)
//   4. Real WebGL 2: compile the tab's shaders and draw the cube
//   5. A JavaScript copy of the fragment shader's math
//   6. Picking: which fragment is under the mouse?
//   7. The code panel
//   8. The overlay on the cube
//   9. The fragment trace
//  10. State, controls and the animation loop


// ---------------------------------------------------------------------
// 1. READING THE TAB'S SOURCE
//    We never hard-code line numbers. Instead we search the text for a
//    snippet (e.g. "vBary = aBary;"), so the explorer keeps working when
//    the tab's comments change. If a snippet is missing, the console says
//    so (then the tab changed in a way this file must follow).
//
//    Tabs 5 and 6 differ in only a few lines:
//      tab 5: uniform int uMode; interpolate() tests "if (uMode == k)"
//      tab 6: flat int vTriangle = gl_VertexID / 3; uniforms uModeEven
//             and uModeOdd; main() picks "int mode", interpolate() tests
//             "if (mode == k)"
//    Everything that only exists in tab 6 is null in tab 5.
// ---------------------------------------------------------------------
const TAB = new URLSearchParams(window.location.search).get('tab') === '6' ? 6 : 5;
const TAB_INFO = {
    5: { lines: TAB5_SOURCE_LINES, file: '5-custom-interpolation.js',
         page: '5-custom-interpolation.html', title: 'tab 5, “Do-it-yourself interpolation”' },
    6: { lines: TAB6_SOURCE_LINES, file: '6-per-triangle-rules.js',
         page: '6-per-triangle-rules.html', title: 'tab 6, “Per-triangle rules”' },
};
const SOURCE = TAB_INFO[TAB].lines;   // SOURCE[0] is line 1
const RULE_VARIABLE = (TAB === 6) ? 'mode' : 'uMode';   // what interpolate() tests

// The 1-based line number of the first line at or after `fromLine`
// (and before `toLine`, if given) that contains `snippet`.
// Comment-only lines are skipped: tab 5's comments contain example code
// such as "if (uMode == 5) { ... }", which must not count as the real line.
function findLine(snippet, fromLine = 1, toLine = SOURCE.length) {
    for (let n = fromLine; n <= toLine; n++) {
        const text = SOURCE[n - 1];
        if (text.trim().startsWith('//')) continue;
        if (text.includes(snippet)) return n;
    }
    console.warn('Snippet not found in tab ' + TAB + ' source:', snippet);
    return null;
}

// The file is split into a header comment and sections 0-5. Each section
// starts with a "// ------" line followed by "// 0. ...", "// 1. ...".
const SECTIONS = [];
for (let n = 2; n <= SOURCE.length; n++) {
    const match = SOURCE[n - 1].match(/^\/\/ (\d)\. (.*)$/);
    if (match && SOURCE[n - 2].startsWith('// ----')) {
        SECTIONS.push({ title: match[1] + '. ' + match[2], start: n - 1 });
    }
}
SECTIONS.unshift({ title: 'Header comment: what this example shows, and the trick it uses', start: 1 });
for (let i = 0; i < SECTIONS.length; i++) {
    SECTIONS[i].end = (i + 1 < SECTIONS.length) ? SECTIONS[i + 1].start - 1 : SOURCE.length;
}

// A shader is the text between the backtick after "const <name> =" and
// the line "`;". Its first line is what follows the backtick
// ("#version 300 es"). This is exactly the string the tab compiles.
function extractShader(name) {
    const first = findLine('const ' + name + ' =');
    const last = findLine('`;', first);
    const lines = SOURCE.slice(first - 1, last - 1);
    lines[0] = lines[0].slice(lines[0].indexOf('`') + 1);
    return { source: lines.join('\n'), first, last };
}
const VERTEX_SHADER = extractShader('vertexShaderSource');
const FRAGMENT_SHADER = extractShader('fragmentShaderSource');

// Shorthands for searching only inside one shader.
const inVS = (snippet) => findLine(snippet, VERTEX_SHADER.first, VERTEX_SHADER.last);
const inFS = (snippet, from = FRAGMENT_SHADER.first) => findLine(snippet, from, FRAGMENT_SHADER.last);

// Search only in tab 6 (tab 5 doesn't have the line), or only in tab 5.
const tab6Only = (find) => (TAB === 6) ? find() : null;
const tab5Only = (find) => (TAB === 5) ? find() : null;

// The lines the trace and the overlays point at.
const LINE = {
    vsTriangle:  tab6Only(() => inVS('vTriangle = gl_VertexID / 3;')),
    vsNormal:    inVS('vNormal = normalize(mat3(uModel) * aNormal);'),
    vsBary:      inVS('vBary = aBary;'),
    vsColor0:    inVS('vColor0 = aColor0;'),
    fsBary:      inFS('in vec3 vBary;'),
    fsColor0:    inFS('flat in vec3 vColor0;'),
    fsTriangle:  tab6Only(() => inFS('flat in int vTriangle;')),
    fsUMode:     tab5Only(() => inFS('uniform int uMode;')),
    fsMode:      tab6Only(() => inFS('int mode = (vTriangle % 2 == 0)')),
    fsCall:      inFS('vec3 color = interpolate('),
    fsBright:    inFS('float brightness = max(dot(vNormal, lightDirection), 0.0);'),
    fsLight:     inFS('float light = 0.3 + 0.7 * brightness;'),
    fsOut:       inFS('fragColor = vec4(color * light, 1.0);'),
    unknownMode: inFS('return vec3(1.0, 0.0, 1.0);'),
    drawArrays:  findLine('gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);'),
};

// Where each rule's "if (uMode == k) {" (tab 5) or "if (mode == k) {"
// (tab 6) block starts and ends.
const RULE_BLOCKS = [];
for (let k = 0; k <= 7; k++) {
    RULE_BLOCKS.push({ start: inFS('if (' + RULE_VARIABLE + ' == ' + k + ') {') });
}
for (let k = 0; k <= 7; k++) {
    RULE_BLOCKS[k].end = (k < 7) ? RULE_BLOCKS[k + 1].start - 1 : LINE.unknownMode - 1;
}
// A line inside rule k's block.
const inRule = (k, snippet) => findLine(snippet, RULE_BLOCKS[k].start, RULE_BLOCKS[k].end);

// Underlined lines: clicking one shows an overlay on the cube.
// Each entry: a snippet that identifies the line, the overlay to show,
// and (optionally) the only tab that has the line.
const LINKED_LINES = [
    ['flat out int vTriangle;', 'triangles', 6],
    ['vTriangle = gl_VertexID / 3;', 'triangles', 6],
    ['flat in int vTriangle;', 'triangles', 6],
    ['gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);', 'triangles', 6],
    ['int mode = (vTriangle % 2 == 0)', 'evenOdd', 6],
    ['uniform int uModeEven;', 'evenOdd', 6],
    ['uniform int uModeOdd;', 'evenOdd', 6],
    ['in vec3 aBary;', 'bary'],
    ['vBary = aBary;', 'bary'],
    ['in vec3 vBary;', 'bary'],
    ['const BARY_COORDS = [', 'bary'],
    ['...BARY_COORDS[i],', 'bary'],
    ['in vec3 aColor0;', 'colors'],
    ['flat out vec3 vColor0;', 'colors'],
    ['vColor0 = aColor0;', 'colors'],
    ['flat in vec3 vColor0;', 'colors'],
    ['...color0, ...color1, ...color2,', 'colors'],
];
const OVERLAY_OF_LINE = {};       // line number → overlay name
for (const [snippet, overlay, onlyTab] of LINKED_LINES) {
    if (onlyTab && onlyTab !== TAB) continue;
    const n = findLine(snippet);
    if (n) OVERLAY_OF_LINE[n] = overlay;
}


// ---------------------------------------------------------------------
// 2. THE CUBE'S DATA
//    Copied from tabs 5 and 6, section 2 (identical in both; same names,
//    same order). They keep tab 4's 9-float vertices (position, normal,
//    color) and rebuild them
//    into 18 floats per vertex: position, normal, aBary, aColor0, aColor1,
//    aColor2. We need the data twice: in the GPU buffer, and in JavaScript
//    for the trace.
// ---------------------------------------------------------------------
const BLACK   = [0, 0, 0];
const RED     = [1, 0, 0];
const GREEN   = [0, 1, 0];
const BLUE    = [0, 0, 1];
const YELLOW  = [1, 1, 0];
const MAGENTA = [1, 0, 1];
const CYAN    = [0, 1, 1];
const WHITE   = [1, 1, 1];
const COLOR_NAMES = { BLACK, RED, GREEN, BLUE, YELLOW, MAGENTA, CYAN, WHITE };

const cubeVertices = new Float32Array([
    // Front face (z = +0.5)
    -0.5, -0.5,  0.5,    0,  0,  1,   ...BLUE,
     0.5, -0.5,  0.5,    0,  0,  1,   ...MAGENTA,
     0.5,  0.5,  0.5,    0,  0,  1,   ...WHITE,
    -0.5, -0.5,  0.5,    0,  0,  1,   ...BLUE,
     0.5,  0.5,  0.5,    0,  0,  1,   ...WHITE,
    -0.5,  0.5,  0.5,    0,  0,  1,   ...CYAN,
    // Back face (z = -0.5)
    -0.5, -0.5, -0.5,    0,  0, -1,   ...BLACK,
     0.5,  0.5, -0.5,    0,  0, -1,   ...YELLOW,
     0.5, -0.5, -0.5,    0,  0, -1,   ...RED,
    -0.5, -0.5, -0.5,    0,  0, -1,   ...BLACK,
    -0.5,  0.5, -0.5,    0,  0, -1,   ...GREEN,
     0.5,  0.5, -0.5,    0,  0, -1,   ...YELLOW,
    // Top face (y = +0.5)
    -0.5,  0.5, -0.5,    0,  1,  0,   ...GREEN,
    -0.5,  0.5,  0.5,    0,  1,  0,   ...CYAN,
     0.5,  0.5,  0.5,    0,  1,  0,   ...WHITE,
    -0.5,  0.5, -0.5,    0,  1,  0,   ...GREEN,
     0.5,  0.5,  0.5,    0,  1,  0,   ...WHITE,
     0.5,  0.5, -0.5,    0,  1,  0,   ...YELLOW,
    // Bottom face (y = -0.5)
    -0.5, -0.5, -0.5,    0, -1,  0,   ...BLACK,
     0.5, -0.5,  0.5,    0, -1,  0,   ...MAGENTA,
    -0.5, -0.5,  0.5,    0, -1,  0,   ...BLUE,
    -0.5, -0.5, -0.5,    0, -1,  0,   ...BLACK,
     0.5, -0.5, -0.5,    0, -1,  0,   ...RED,
     0.5, -0.5,  0.5,    0, -1,  0,   ...MAGENTA,
    // Right face (x = +0.5)
     0.5, -0.5, -0.5,    1,  0,  0,   ...RED,
     0.5,  0.5, -0.5,    1,  0,  0,   ...YELLOW,
     0.5,  0.5,  0.5,    1,  0,  0,   ...WHITE,
     0.5, -0.5, -0.5,    1,  0,  0,   ...RED,
     0.5,  0.5,  0.5,    1,  0,  0,   ...WHITE,
     0.5, -0.5,  0.5,    1,  0,  0,   ...MAGENTA,
    // Left face (x = -0.5)
    -0.5, -0.5, -0.5,   -1,  0,  0,   ...BLACK,
    -0.5,  0.5,  0.5,   -1,  0,  0,   ...CYAN,
    -0.5,  0.5, -0.5,   -1,  0,  0,   ...GREEN,
    -0.5, -0.5, -0.5,   -1,  0,  0,   ...BLACK,
    -0.5, -0.5,  0.5,   -1,  0,  0,   ...BLUE,
    -0.5,  0.5,  0.5,   -1,  0,  0,   ...CYAN,
]);
const FACE_NAMES = ['front', 'back', 'top', 'bottom', 'right', 'left'];

const VERTEX_COUNT = 36;
const FLOATS_PER_INPUT_VERTEX = 9;
const FLOATS_PER_VERTEX = 18;
const BARY_COORDS = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
];

function positionAndNormalOf(v) {
    const start = v * FLOATS_PER_INPUT_VERTEX;
    return cubeVertices.slice(start, start + 6);
}
function colorOf(v) {
    const start = v * FLOATS_PER_INPUT_VERTEX;
    return cubeVertices.slice(start + 6, start + 9);
}
const positionOf = (v) => Array.from(positionAndNormalOf(v).slice(0, 3));
const normalOf = (v) => Array.from(positionAndNormalOf(v).slice(3, 6));

// The same loop as tabs 5 and 6: for each triangle, every vertex gets its
// position and normal, its own barycentric coordinates, and ALL THREE
// vertex colors of the triangle.
const vertexList = [];
for (let first = 0; first < VERTEX_COUNT; first += 3) {
    const color0 = colorOf(first);
    const color1 = colorOf(first + 1);
    const color2 = colorOf(first + 2);
    for (let i = 0; i < 3; i++) {
        vertexList.push(
            ...positionAndNormalOf(first + i),
            ...BARY_COORDS[i],
            ...color0, ...color1, ...color2,
        );
    }
}
const vertexData = new Float32Array(vertexList);   // 36 × 18 numbers

// The name of a color constant ("BLUE"), for the trace.
function colorName(rgb) {
    for (const [name, value] of Object.entries(COLOR_NAMES)) {
        if (value[0] === rgb[0] && value[1] === rgb[1] && value[2] === rgb[2]) return name;
    }
    return '?';
}


// ---------------------------------------------------------------------
// 3. MATRIX HELPERS
//    rotationX, rotationY, multiply, perspective and lookAt are copied
//    from tabs 5 and 6 (column-major, like WebGL). transform() and normalize3()
//    are new: we need them to redo the vertex shader's math in JS.
// ---------------------------------------------------------------------
function rotationX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        1, 0,  0, 0,
        0, c,  s, 0,
        0, -s, c, 0,
        0, 0,  0, 1,
    ];
}

function rotationY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        c, 0, -s, 0,
        0, 1, 0,  0,
        s, 0, c,  0,
        0, 0, 0,  1,
    ];
}

function multiply(a, b) {
    const result = new Array(16).fill(0);
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            for (let k = 0; k < 4; k++) {
                result[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
            }
        }
    }
    return result;
}

function perspective(fieldOfView, aspect, near, far) {
    const f = 1 / Math.tan(fieldOfView / 2);
    return [
        f / aspect, 0, 0,                               0,
        0,          f, 0,                               0,
        0,          0, (far + near) / (near - far),    -1,
        0,          0, (2 * far * near) / (near - far), 0,
    ];
}

function lookAt(eye, target, up) {
    const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
    const zAxis = normalize3(subtract(eye, target));
    const xAxis = normalize3(cross(up, zAxis));
    const yAxis = cross(zAxis, xAxis);
    return [
        xAxis[0], yAxis[0], zAxis[0], 0,
        xAxis[1], yAxis[1], zAxis[1], 0,
        xAxis[2], yAxis[2], zAxis[2], 0,
        -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
    ];
}

function normalize3(a) {
    const length = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / length, a[1] / length, a[2] / length];
}

// Matrix (column-major) times the column vector [x, y, z, w].
function transform(m, v) {
    const out = [0, 0, 0, 0];
    for (let row = 0; row < 4; row++) {
        out[row] = m[row] * v[0] + m[4 + row] * v[1] + m[8 + row] * v[2] + m[12 + row] * v[3];
    }
    return out;
}

const EYE = [0, 0, 3];                 // the tabs' camera
const SPIN_SPEED = 0.3;                // the tabs' speed (radians per second)

// The three matrices the tab's draw() sends, for a given time.
function matricesAt(seconds, aspect) {
    const angle = seconds * SPIN_SPEED;
    return {
        model: multiply(rotationY(angle), rotationX(0.7 * angle)),
        view: lookAt(EYE, [0, 0, 0], [0, 1, 0]),
        projection: perspective(Math.PI / 4, aspect, 0.1, 100),
    };
}


// ---------------------------------------------------------------------
// 4. REAL WEBGL 2
//    The same steps as tabs 5 and 6: compile the two shaders (the exact strings
//    from section 1), upload vertexData, connect the six attributes,
//    draw 36 vertices.
//    Two differences, both only for this explorer:
//      - preserveDrawingBuffer: true keeps the last picture, so we can
//        read a pixel back with gl.readPixels at any time.
//      - the canvas size includes window.devicePixelRatio, so it is
//        sharp on high-DPI screens and pixels map 1:1 for picking.
// ---------------------------------------------------------------------
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });

function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

const program = gl.createProgram();
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, VERTEX_SHADER.source));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER.source));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
}
gl.useProgram(program);

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

const BYTES_PER_FLOAT = 4;
const stride = FLOATS_PER_VERTEX * BYTES_PER_FLOAT;
function connectAttribute(name, offsetInFloats) {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, stride, offsetInFloats * BYTES_PER_FLOAT);
}
connectAttribute('aPosition', 0);
connectAttribute('aNormal',   3);
connectAttribute('aBary',     6);
connectAttribute('aColor0',   9);
connectAttribute('aColor1',  12);
connectAttribute('aColor2',  15);

const uModel = gl.getUniformLocation(program, 'uModel');
const uView = gl.getUniformLocation(program, 'uView');
const uProjection = gl.getUniformLocation(program, 'uProjection');
const uTime = gl.getUniformLocation(program, 'uTime');
// The rule uniforms: one in tab 5, two in tab 6.
const uMode = (TAB === 5) ? gl.getUniformLocation(program, 'uMode') : null;
const uModeEven = (TAB === 6) ? gl.getUniformLocation(program, 'uModeEven') : null;
const uModeOdd = (TAB === 6) ? gl.getUniformLocation(program, 'uModeOdd') : null;

// Match the drawing buffer to the canvas's CSS size × devicePixelRatio.
function resizeCanvas(c) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
    }
}

// Draw one picture, as the tab's draw() does. In tab 5, modeEven is the
// one rule (uMode) and modeOdd is ignored.
function drawCube(m, modeEven, modeOdd, seconds) {
    resizeCanvas(canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.12, 0.12, 0.12, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(uProjection, false, m.projection);
    gl.uniformMatrix4fv(uView, false, m.view);
    gl.uniformMatrix4fv(uModel, false, m.model);
    if (TAB === 5) {
        gl.uniform1i(uMode, modeEven);
    } else {
        gl.uniform1i(uModeEven, modeEven);
        gl.uniform1i(uModeOdd, modeOdd);
    }
    gl.uniform1f(uTime, seconds);
    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
}

// The RGBA bytes (0-255) of one pixel. x, y count from the BOTTOM-left,
// as WebGL does.
function readPixel(x, y) {
    const out = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return Array.from(out);
}


// ---------------------------------------------------------------------
// 5. A JAVASCRIPT COPY OF THE FRAGMENT SHADER'S MATH
//    interpolateJS() mirrors interpolate() in the fragment shader, rule
//    by rule, with the same names. Besides the color, it records each
//    in-between value and the line of code that computes it, so the
//    trace can show them. GLSL helpers redone by hand:
//      fract(x) = x - floor(x)      mod(x, y) = x - y·floor(x / y)
//      mix(a, b, t) = a + (b - a)·t
// ---------------------------------------------------------------------
const RULE_NAMES = [
    'Linear', 'Nearest vertex', 'Sharpened', 'Bands', 'Wireframe',
    'Ripple', 'Growing territory', 'Growing wireframe',
];

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const fract = (x) => x - Math.floor(x);
const glslMod = (x, y) => x - y * Math.floor(x / y);
const mix = (a, b, t) => a + (b - a) * t;

// w.x·c0 + w.y·c1 + w.z·c2
function weighted(w, c) {
    return add3(add3(scale3(c[0], w[0]), scale3(c[1], w[1])), scale3(c[2], w[2]));
}

// Rule 1's three lines, in the order the GPU checks them.
const NEAREST_LINES = [
    'if (b.x >= b.y && b.x >= b.z) return c0;',
    'if (b.y >= b.z) return c1;',
    'return c2;',
];
function nearestIndex(b) {
    if (b[0] >= b[1] && b[0] >= b[2]) return 0;
    if (b[1] >= b[2]) return 1;
    return 2;
}

// mode: the rule; b: [λ0, λ1, λ2]; c: [c0, c1, c2]; time: uTime.
// Returns { color, steps }, where each step is
//   { text: HTML to show, line: the code line it comes from }.
function interpolateJS(mode, b, c, time) {
    const steps = [];
    const step = (text, snippet) => steps.push({ text, line: inRule(mode, snippet) });
    const nearest = () => {
        const k = nearestIndex(b);
        step(`largest weight: λ${k} = ${f3(b[k])} → <b>c${k}</b> ${swatch(c[k])}`, NEAREST_LINES[k]);
        return c[k];
    };
    const LINEAR = 'return b.x * c0 + b.y * c1 + b.z * c2;';

    if (mode === 0) {
        const color = weighted(b, c);
        step(`λ0·c0 + λ1·c1 + λ2·c2 = <b>${v3(color)}</b>`, LINEAR);
        return { color, steps };
    }
    if (mode === 1) {
        return { color: nearest(), steps };
    }
    if (mode === 2) {
        const power = 4.0;
        let w = b.map((x) => Math.pow(Math.max(x, 0), power));
        step(`w = λ<sup>${power}</sup> = ${v3(w)}`, 'vec3 w = pow(max(b, 0.0), vec3(power));');
        const sum = w[0] + w[1] + w[2];
        w = scale3(w, 1 / sum);
        step(`sum = ${f3(sum)} → w / sum = ${v3(w)}`, 'w = w / (w.x + w.y + w.z);');
        const color = weighted(w, c);
        step(`w.x·c0 + w.y·c1 + w.z·c2 = <b>${v3(color)}</b>`, 'return w.x * c0 + w.y * c1 + w.z * c2;');
        return { color, steps };
    }
    if (mode === 3) {
        const steps4 = 4.0;
        let w = b.map((x) => Math.floor(x * steps4) / steps4);
        step(`w = floor(λ·${steps4}) / ${steps4} = ${v3(w)}`, 'vec3 w = floor(b * steps) / steps;');
        const sum = w[0] + w[1] + w[2];
        w = scale3(w, 1 / sum);
        step(`sum = ${f3(sum)} → w / sum = ${v3(w)}`, 'w = w / (w.x + w.y + w.z);');
        const color = weighted(w, c);
        step(`w.x·c0 + w.y·c1 + w.z·c2 = <b>${v3(color)}</b>`, 'return w.x * c0 + w.y * c1 + w.z * c2;');
        return { color, steps };
    }
    if (mode === 4 || mode === 7) {
        let threshold = 0.02;
        if (mode === 7) {
            const secondsPerCycle = 4.0;
            const progress = fract(time / secondsPerCycle);
            step(`progress = fract(${f2(time)} / ${secondsPerCycle}) = ${f3(progress)}`, 'float progress = fract(');
            const upAndDown = 1 - Math.abs(2 * progress - 1);
            step(`upAndDown = ${f3(upAndDown)}`, 'float upAndDown =');
            threshold = mix(0.02, 1 / 3, upAndDown);
            step(`threshold = mix(0.02, 1/3, upAndDown) = ${f3(threshold)}`, 'float threshold =');
        }
        let color = weighted(b, c);
        step(`linear color = ${v3(color)}`, 'vec3 color = b.x * c0 + b.y * c1 + b.z * c2;');
        const distanceToEdge = Math.min(b[0], b[1], b[2]);
        step(`distanceToEdge = smallest λ = ${f3(distanceToEdge)}`, 'float distanceToEdge = min(b.x, min(b.y, b.z));');
        const nearEdge = distanceToEdge < threshold;
        step(`${f3(distanceToEdge)} &lt; ${f3(threshold)}? <b>${nearEdge ? 'yes: near an edge' : 'no'}</b>`,
             mode === 4 ? 'if (distanceToEdge < 0.02) {' : 'if (distanceToEdge < threshold) {');
        if (nearEdge) {
            color = [0.05, 0.05, 0.05];
            step(`color = <b>${v3(color)}</b> (almost black)`, 'color = vec3(0.05);');
        }
        step(`returns <b>${v3(color)}</b>`, 'return color;');
        return { color, steps };
    }
    if (mode === 5) {
        const rings = 4.0;
        const secondsPerRing = 1.5;
        const distanceToEdge = Math.min(b[0], b[1], b[2]);
        step(`distanceToEdge = smallest λ = ${f3(distanceToEdge)}`, 'float distanceToEdge = min(b.x, min(b.y, b.z));');
        const wave = Math.sin(6.2832 * (rings * distanceToEdge * 3.0 - time / secondsPerRing));
        step(`wave = sin(6.2832·(${rings}·${f3(distanceToEdge)}·3 − ${f2(time)}/${secondsPerRing})) = ${f3(wave)}`,
             'float wave = sin(');
        step(`wave &gt; 0? <b>${wave > 0 ? 'yes → rule 0 (linear)' : 'no → rule 1 (nearest vertex)'}</b>`,
             'if (wave > 0.0) {');
        if (wave > 0) {
            const color = weighted(b, c);
            step(`λ0·c0 + λ1·c1 + λ2·c2 = <b>${v3(color)}</b>`, LINEAR);
            return { color, steps };
        }
        return { color: nearest(), steps };
    }
    if (mode === 6) {
        const secondsPerTurn = 3.0;
        const turns = time / secondsPerTurn;
        step(`turns = ${f2(time)} / ${secondsPerTurn} = ${f3(turns)}`, 'float turns = uTime / secondsPerTurn;');
        const k = Math.trunc(glslMod(Math.floor(turns), 3.0));
        step(`k = floor(turns) mod 3 = <b>${k}</b> (vertex ${k}'s turn)`, 'int k = int(mod(floor(turns), 3.0));');
        const progress = fract(turns);
        const upAndDown = 1 - Math.abs(2 * progress - 1);
        step(`progress = ${f3(progress)}, upAndDown = ${f3(upAndDown)}`, 'float upAndDown =');
        const T = 0.5 + 0.5 * upAndDown;
        step(`T = 0.5 + 0.5·upAndDown = ${f3(T)}`, 'float T = 0.5 + 0.5 * upAndDown;');
        const lambdaK = b[k];
        step(`lambdaK = b[${k}] = ${f3(lambdaK)}, colorK = c${k} ${swatch(c[k])}`, 'float lambdaK = b[k];');
        const claimed = lambdaK >= 1 - T;
        step(`${f3(lambdaK)} ≥ 1 − T = ${f3(1 - T)}? <b>${claimed ? 'yes: vertex ' + k + "'s territory" : 'no → rule 1'}</b>`,
             'if (lambdaK >= 1.0 - T) return colorK;');
        if (claimed) return { color: c[k], steps };
        return { color: nearest(), steps };
    }
    steps.push({ text: 'unknown mode → bright pink', line: LINE.unknownMode });
    return { color: [1, 0, 1], steps };
}


// ---------------------------------------------------------------------
// 6. PICKING: WHICH FRAGMENT IS UNDER THE MOUSE?
//    We redo the vertex shader for all 36 vertices (gl_Position =
//    P·V·M·position), divide by w, and apply the viewport, as the GPU
//    does. Then we find the triangle that covers the pixel's CENTER.
//    The cube is convex, so only one FRONT-FACING triangle can cover a
//    point; we skip triangles whose normal points away from the camera.
//
//    Barycentric coordinates: the 2D weights (s0, s1, s2) of the point
//    in the triangle ON SCREEN are not quite the λ the shader gets. The
//    rasterizer corrects for perspective: λi = (si / wi) / Σ(sj / wj),
//    where wi is the w of vertex i's clip-space position. (Without this,
//    textures and colors would slide on a tilted face.)
// ---------------------------------------------------------------------

// Every vertex in window coordinates (pixels, y up) plus its clip w.
function projectAll(m, width, height) {
    const pvm = multiply(m.projection, multiply(m.view, m.model));
    const out = [];
    for (let v = 0; v < VERTEX_COUNT; v++) {
        const clip = transform(pvm, [...positionOf(v), 1]);
        const ndc = [clip[0] / clip[3], clip[1] / clip[3]];
        out.push({
            x: (ndc[0] + 1) / 2 * width,
            y: (ndc[1] + 1) / 2 * height,
            w: clip[3],
        });
    }
    return out;
}

// The normal turned by the model matrix: normalize(mat3(uModel) * aNormal).
function turnedNormal(model, n) {
    return normalize3([
        model[0] * n[0] + model[4] * n[1] + model[8] * n[2],
        model[1] * n[0] + model[5] * n[1] + model[9] * n[2],
        model[2] * n[0] + model[6] * n[1] + model[10] * n[2],
    ]);
}

// Does triangle t face the camera?
function facesCamera(m, t) {
    const n = turnedNormal(m.model, normalOf(3 * t));
    const corner = transform(m.model, [...positionOf(3 * t), 1]);
    const toEye = [EYE[0] - corner[0], EYE[1] - corner[1], EYE[2] - corner[2]];
    return n[0] * toEye[0] + n[1] * toEye[1] + n[2] * toEye[2] > 0;
}

// 2D barycentric weights of point p in triangle (a, b, c), or null if
// p is outside.
function screenWeights(p, a, b, c) {
    const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
    if (area === 0) return null;
    const s0 = ((b.x - p.x) * (c.y - p.y) - (c.x - p.x) * (b.y - p.y)) / area;
    const s1 = ((c.x - p.x) * (a.y - p.y) - (a.x - p.x) * (c.y - p.y)) / area;
    const s2 = 1 - s0 - s1;
    if (s0 < 0 || s1 < 0 || s2 < 0) return null;
    return [s0, s1, s2];
}

// The fragment at window pixel (px, py) (y up), or null for background.
function pickFragment(m, px, py, width, height) {
    const screen = projectAll(m, width, height);
    const p = { x: px + 0.5, y: py + 0.5 };            // the pixel's center
    for (let t = 0; t < VERTEX_COUNT / 3; t++) {
        if (!facesCamera(m, t)) continue;
        const s = screenWeights(p, screen[3 * t], screen[3 * t + 1], screen[3 * t + 2]);
        if (!s) continue;
        const q = s.map((si, i) => si / screen[3 * t + i].w);   // perspective correction
        const sum = q[0] + q[1] + q[2];
        return { triangle: t, bary: q.map((qi) => qi / sum) };
    }
    return null;
}


// ---------------------------------------------------------------------
// 7. THE CODE PANEL
//    One <div class="line"> per line of the tab, grouped by section. A
//    fold row before each section opens and closes it. Comments are
//    dimmed; linked lines are underlined; lines the traced fragment ran
//    through get the class "ran".
// ---------------------------------------------------------------------
const codeBox = document.getElementById('code');
const lineElements = [];                 // lineElements[n] = the div of line n
const sectionBodies = [];                // the folding div of each section

// Sections open at the start: 1 (shaders) and 2 (geometry → buffer).
const OPEN_AT_START = new Set([2, 3]);   // indexes into SECTIONS (0 = header)

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// The HTML for one line: code, then the "// comment" part dimmed.
function lineHtml(text) {
    const at = text.indexOf('//');
    if (at < 0) return escapeHtml(text);
    return escapeHtml(text.slice(0, at)) + '<span class="cm">' + escapeHtml(text.slice(at)) + '</span>';
}

function buildCodePanel() {
    SECTIONS.forEach((section, i) => {
        const fold = document.createElement('div');
        fold.className = 'fold';
        const body = document.createElement('div');
        body.className = 'sec-body';
        const setLabel = () => {
            const arrow = body.classList.contains('folded') ? '▸' : '▾';
            fold.innerHTML = `${arrow} ${escapeHtml(section.title)} ` +
                `<span class="count">(lines ${section.start}–${section.end})</span>`;
        };
        if (!OPEN_AT_START.has(i)) body.classList.add('folded');
        fold.addEventListener('click', () => { body.classList.toggle('folded'); setLabel(); });
        section.setLabel = setLabel;
        setLabel();

        for (let n = section.start; n <= section.end; n++) {
            const div = document.createElement('div');
            div.className = 'line';
            div.innerHTML = `<span class="ln">${n}</span><span class="src">${lineHtml(SOURCE[n - 1]) || ' '}</span>`;
            const overlay = OVERLAY_OF_LINE[n];
            if (overlay) {
                div.classList.add('linked');
                div.title = 'Click to show this on the cube';
                div.insertAdjacentHTML('beforeend', '<span class="tag">◀ show on cube</span>');
                div.addEventListener('click', () => toggleOverlay(overlay));
            }
            lineElements[n] = div;
            body.appendChild(div);
        }
        sectionBodies.push(body);
        codeBox.appendChild(fold);
        codeBox.appendChild(body);
    });
    document.getElementById('codeLegend').innerHTML =
        `${SOURCE.length} lines · <u style="text-decoration-style:dotted">underlined</u> = show on cube · ` +
        `<span style="border-left:3px solid var(--ran-bar);padding-left:4px">marked</span> = ran for the traced fragment`;
}

function setAllFolded(folded) {
    SECTIONS.forEach((section, i) => {
        sectionBodies[i].classList.toggle('folded', folded);
        section.setLabel();
    });
}

// Open the section that holds line n, scroll to it and flash it.
function showLine(n) {
    if (!n) return;
    const i = SECTIONS.findIndex((s) => n >= s.start && n <= s.end);
    if (sectionBodies[i].classList.contains('folded')) {
        sectionBodies[i].classList.remove('folded');
        SECTIONS[i].setLabel();
    }
    const div = lineElements[n];
    div.scrollIntoView({ block: 'center', behavior: 'smooth' });
    div.classList.add('flash');
    setTimeout(() => div.classList.remove('flash'), 900);
}

// Mark the lines the traced fragment ran through (and clear old marks).
function markRanLines(lines) {
    for (const div of lineElements) if (div) div.classList.remove('ran');
    for (const n of lines) if (n && lineElements[n]) lineElements[n].classList.add('ran');
}

// Highlight the linked lines of the overlay being shown.
function markOverlayLines(overlay) {
    for (const [n, name] of Object.entries(OVERLAY_OF_LINE)) {
        lineElements[n].classList.toggle('active-overlay', name === overlay);
    }
}


// ---------------------------------------------------------------------
// 8. THE OVERLAY ON THE CUBE
//    A transparent 2D canvas on top of the WebGL canvas. It draws labels
//    at the projected positions of the vertices (section 6), in CSS
//    pixels (window y is flipped: CSS y grows downward).
//    Overlays:
//      triangles - (tab 6) every front-facing triangle's number
//                  (gl_VertexID / 3), and the picked triangle's three
//                  gl_VertexID values
//      evenOdd   - (tab 6) outlines: even triangles solid, odd dashed
//      bary      - the picked triangle's aBary at its three vertices
//      colors    - the picked triangle's aColor0/1/2 at its vertices
//    "Picked triangle" = the triangle of the traced fragment, or if
//    nothing is picked, the front-facing triangle that looks biggest.
// ---------------------------------------------------------------------
const overlayCanvas = document.getElementById('overlay');
const ctx = overlayCanvas.getContext('2d');
const overlayNote = document.getElementById('overlayNote');

const OVERLAY_NOTES = {
    triangles: () =>
        `<b>Triangle numbers</b> (<code>vTriangle = gl_VertexID / 3</code>), on the faces turned toward you. ` +
        `With <code>drawArrays</code>, <code>gl_VertexID</code> counts 0 … 35 through the buffer, and every 3 make one triangle. ` +
        `The outlined triangle also shows its 3 vertex IDs.`,
    evenOdd: () =>
        `<b>Even triangles</b> (solid outline) use <code>uModeEven</code> = ${RULE_NAMES[state.modeEven]}; ` +
        `<b>odd triangles</b> (dashed) use <code>uModeOdd</code> = ${RULE_NAMES[state.modeOdd]}. ` +
        `Each face is one even and one odd triangle, so the diagonal is where the rules meet.`,
    bary: () =>
        `<b>aBary</b> of the outlined triangle: its 1st vertex in the buffer gets (1,0,0), the 2nd (0,1,0), the 3rd (0,0,1). ` +
        `The rasterizer interpolates them, so each fragment gets its own (λ0, λ1, λ2).`,
    colors: () =>
        `<b>aColor0, aColor1, aColor2</b> of the outlined triangle: C0 is its 1st vertex's color, C1 the 2nd's, C2 the 3rd's. ` +
        `All three of its vertices carry the same three colors, ` +
        `passed on as <code>flat</code>, so every fragment knows all three corner colors.`,
};

function toggleOverlay(name) {
    state.overlay = (state.overlay === name) ? null : name;
    overlayNote.hidden = !state.overlay;
    markOverlayLines(state.overlay);
    state.dirty = true;
}

// The triangle the overlays describe.
function focusTriangle(m, screen) {
    if (state.fragment) return state.fragment.triangle;
    let best = 0;
    let bestArea = -1;
    for (let t = 0; t < 12; t++) {
        if (!facesCamera(m, t)) continue;
        const [a, b, c] = [screen[3 * t], screen[3 * t + 1], screen[3 * t + 2]];
        const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
        if (area > bestArea) { bestArea = area; best = t; }
    }
    return best;
}

// A text label with a dark box behind it, centered at (x, y).
function label(text, x, y, color = '#fff') {
    ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(x - w / 2, y - 9, w, 18);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
}

// Where to put a vertex label: pulled a little toward the triangle's
// center, so labels of neighboring triangles don't sit on top of each other.
function insetPoint(p, center, amount = 0.28) {
    return { x: p.x + (center.x - p.x) * amount, y: p.y + (center.y - p.y) * amount };
}

function drawOverlay(m) {
    resizeCanvas(overlayCanvas);
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);       // draw in CSS pixels

    // Window coordinates (device pixels, y up) → CSS pixels (y down).
    const screen = projectAll(m, canvas.width, canvas.height).map((p) => ({
        x: p.x / dpr, y: (canvas.height - p.y) / dpr,
    }));
    const corners = (t) => [screen[3 * t], screen[3 * t + 1], screen[3 * t + 2]];
    const centerOf = (t) => {
        const [a, b, c] = corners(t);
        return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    };
    const outline = (t, color, dashed = false, width = 1.5) => {
        const [a, b, c] = corners(t);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dashed ? [6, 4] : []);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
    };

    if (state.overlay) {
        overlayNote.innerHTML = OVERLAY_NOTES[state.overlay]();
        const focus = focusTriangle(m, screen);
        const front = [];
        for (let t = 0; t < 12; t++) if (facesCamera(m, t)) front.push(t);

        if (state.overlay === 'triangles') {
            for (const t of front) {
                outline(t, 'rgba(255,255,255,0.35)', false, 1);
                const c = centerOf(t);
                label(`${t}`, c.x, c.y);
            }
            outline(focus, '#fff', false, 2.5);
            const center = centerOf(focus);
            corners(focus).forEach((p, i) => {
                const q = insetPoint(p, center);
                label(`id ${3 * focus + i}`, q.x, q.y, '#ffd54a');
            });
        }
        if (state.overlay === 'evenOdd') {
            for (const t of front) {
                const even = t % 2 === 0;
                outline(t, even ? '#fff' : '#ffd54a', !even, 2);
                const c = centerOf(t);
                const mode = even ? state.modeEven : state.modeOdd;
                label(`${t} ${even ? 'even' : 'odd'} → ${mode}`, c.x, c.y, even ? '#fff' : '#ffd54a');
            }
        }
        if (state.overlay === 'bary' || state.overlay === 'colors') {
            outline(focus, '#fff', false, 2.5);
            const center = centerOf(focus);
            corners(focus).forEach((p, i) => {
                const q = insetPoint(p, center);
                if (state.overlay === 'bary') {
                    label(`(${BARY_COORDS[i].join(',')})`, q.x, q.y);
                } else {
                    const rgb = Array.from(colorOf(3 * focus + i));
                    label(`C${i} ${colorName(rgb)}`, q.x, q.y, cssColor(rgb, true));
                }
            });
        }
    }

    // The picked fragment: a small ring.
    if (state.pixel) {
        const x = (state.pixel.x + 0.5) / dpr;
        const y = (canvas.height - state.pixel.y - 0.5) / dpr;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, 2 * Math.PI); ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, 2 * Math.PI); ctx.stroke();
    }
}


// ---------------------------------------------------------------------
// 9. THE FRAGMENT TRACE
//    Follows the picked fragment through the tab's code, in pipeline
//    order. Every row has a "line N" button that jumps to the code.
//    Tab 5 has no triangle number and only one rule, so its trace skips
//    the "which triangle?" and "pick the rule" steps.
// ---------------------------------------------------------------------
const traceBody = document.getElementById('traceBody');
const TRACE_HINT = traceBody.innerHTML;

const f2 = (x) => x.toFixed(2);
const f3 = (x) => x.toFixed(3);
const v3 = (v) => `(${f3(v[0])}, ${f3(v[1])}, ${f3(v[2])})`;
function cssColor(rgb, brighten = false) {
    let c = rgb.map((x) => Math.round(Math.min(Math.max(x, 0), 1) * 255));
    if (brighten && c[0] + c[1] + c[2] < 120) c = [170, 170, 170];   // keep BLACK readable
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
const swatch = (rgb) => `<span class="swatch" style="background:${cssColor(rgb)}"></span>`;
const lineButton = (n) => n ? `<button class="ln-link" data-line="${n}">line ${n}</button>` : '';
const row = (html, n, extraClass = '') =>
    `<div class="row ${extraClass}"><span class="expr">${html}</span>${lineButton(n)}</div>`;

function renderTrace(m) {
    if (!state.pixel) {
        traceBody.innerHTML = TRACE_HINT;
        markRanLines([]);
        return;
    }
    const { x, y } = state.pixel;
    const drawn = readPixel(x, y);
    const frag = state.fragment;
    if (!frag) {
        traceBody.innerHTML =
            `<div class="step"><h3>Pixel (${x}, ${y}): background</h3>` +
            `<p class="what">No triangle covers this pixel, so no fragment shader ran here. ` +
            `The pixel keeps the clear color: (${drawn.slice(0, 3).join(', ')}).</p></div>`;
        markRanLines([]);
        return;
    }

    const t = frag.triangle;
    const b = frag.bary;
    const c = [0, 1, 2].map((i) => Array.from(colorOf(3 * t + i)));
    const even = t % 2 === 0;
    const mode = even ? state.modeEven : state.modeOdd;
    const result = interpolateJS(mode, b, c, state.seconds);

    // Lighting, as in main().
    const normal = turnedNormal(m.model, normalOf(3 * t));
    const lightDirection = normalize3([0.5, 1.0, 0.3]);
    const brightness = Math.max(normal[0] * lightDirection[0] + normal[1] * lightDirection[1] +
                                normal[2] * lightDirection[2], 0);
    const light = 0.3 + 0.7 * brightness;
    const finalColor = scale3(result.color, light);
    const predicted = finalColor.map((v) => Math.round(Math.min(Math.max(v, 0), 1) * 255));
    const difference = Math.max(...predicted.map((p, i) => Math.abs(p - drawn[i])));

    const ruleLines = result.steps.map((s) => s.line);
    const face = FACE_NAMES[Math.floor(t / 2)];
    let stepNumber = 0;
    const heading = (text) => `<div class="step"><h3>${++stepNumber}. ${text}</h3>`;
    let html = '';

    if (TAB === 6) {
        html += heading('Vertex shader: which triangle?') +
            `<p class="what">Pixel (${x}, ${y}) is covered by a triangle on the ${face} face. ` +
            `Its three vertices are numbers ${3 * t}, ${3 * t + 1}, ${3 * t + 2} in the buffer.</p>` +
            row(`gl_VertexID = ${3 * t}, ${3 * t + 1}, ${3 * t + 2} → vTriangle = gl_VertexID / 3 = <b>${t}</b> for all three`, LINE.vsTriangle) +
            `</div>`;
    }

    html += heading('Rasterizer: what the fragment shader receives') +
        (TAB === 5 ? `<p class="what">Pixel (${x}, ${y}) is covered by a triangle on the ${face} face ` +
                     `(vertices ${3 * t}, ${3 * t + 1}, ${3 * t + 2} in the buffer).</p>` : '') +
        `<p class="what"><code>vBary</code> is interpolated: these are this fragment's barycentric coordinates. ` +
        `The colors${TAB === 6 ? ' and <code>vTriangle</code>' : ''} are <code>flat</code>: passed on unchanged.</p>` +
        row(`vBary = (λ0, λ1, λ2) = <b>${v3(b)}</b> (sum ${f3(b[0] + b[1] + b[2])})`, LINE.fsBary) +
        row(`vColor0, vColor1, vColor2 = ${c.map((ci) => swatch(ci) + colorName(ci)).join(', ')}`, LINE.fsColor0) +
        (TAB === 6 ? row(`vTriangle = ${t}`, LINE.fsTriangle) : '') +
        `</div>`;

    if (TAB === 6) {
        html += heading('main(): pick the rule') +
            row(`${t} % 2 = ${t % 2} → ${even ? 'even' : 'odd'} → mode = ${even ? 'uModeEven' : 'uModeOdd'} = <b>${mode}</b> (${RULE_NAMES[mode]})`, LINE.fsMode) +
            row(`calls interpolate(${mode}, vBary, vColor0, vColor1, vColor2)`, LINE.fsCall) +
            `</div>`;
    }

    html += heading(`interpolate(): rule ${mode}, ${RULE_NAMES[mode]}`) +
        (TAB === 5
            ? row(`main() calls interpolate(vBary, vColor0, vColor1, vColor2)`, LINE.fsCall) +
              row(`uMode = <b>${mode}</b> (set from the menu, the same for every fragment)`, LINE.fsUMode)
            : '') +
        row(`if (${RULE_VARIABLE} == ${mode}) → this block runs`, RULE_BLOCKS[mode].start) +
        result.steps.map((s) => row(s.text, s.line)).join('') +
        row(`color = ${swatch(result.color)} <b>${v3(result.color)}</b>`, null, 'result') +
        `</div>`;

    html += heading('main(): lighting') +
        row(`vNormal = ${v3(normal)} (the face's normal, turned with the cube)`, LINE.vsNormal) +
        row(`brightness = max(dot(vNormal, lightDirection), 0) = ${f3(brightness)}`, LINE.fsBright) +
        row(`light = 0.3 + 0.7 · ${f3(brightness)} = ${f3(light)}`, LINE.fsLight) +
        row(`fragColor = color × light = ${swatch(finalColor)} <b>${v3(finalColor)}</b>`, LINE.fsOut) +
        `</div>`;

    const verdict = difference <= 3
        ? `<span class="ok">✓ matches</span> (largest difference ${difference}/255)`
        : `<span class="warn">differs by ${difference}/255</span>. This point is probably on a border between two branches ` +
          `(or on a triangle's edge); the GPU's rounding went the other way. Try a pixel next to it.`;
    html += heading('The pixel WebGL really drew') +
        row(`predicted × 255 = (${predicted.join(', ')}) ${swatch(finalColor)}`, null) +
        row(`gl.readPixels → (${drawn.slice(0, 3).join(', ')}) ${swatch(drawn.slice(0, 3).map((v) => v / 255))}`, null) +
        row(verdict, null) +
        `</div>`;

    traceBody.innerHTML = html;
    // (Lines a tab doesn't have are null and are skipped.)
    markRanLines([
        LINE.vsTriangle, LINE.vsBary, LINE.vsColor0, LINE.vsNormal,
        LINE.fsMode, LINE.fsUMode, LINE.fsCall, RULE_BLOCKS[mode].start, ...ruleLines,
        LINE.fsBright, LINE.fsLight, LINE.fsOut,
    ]);
}

// "line N" buttons in the trace jump to the code.
traceBody.addEventListener('click', (event) => {
    const button = event.target.closest('.ln-link');
    if (button) showLine(Number(button.dataset.line));
});


// ---------------------------------------------------------------------
// 10. STATE, CONTROLS AND THE ANIMATION LOOP
//    state.seconds is uTime (and sets the angle, as in the tabs). While the
//    cube plays, it advances with the clock and wraps at 72 s (a whole
//    number of cycles of rules 5, 6 and 7). Clicking the cube pauses it
//    and picks the pixel; while paused, changing a menu or the time
//    slider re-traces the same pixel. Playing again drops the pick.
//    Tab 5 has one menu: the odd-triangle menu is hidden, and
//    state.modeOdd always equals state.modeEven, so every triangle uses
//    the one rule.
// ---------------------------------------------------------------------
const TIME_MAX = 72;
const evenMenu = document.getElementById('modeEven');
const oddMenu = document.getElementById('modeOdd');
const playButton = document.getElementById('playPause');
const timeSlider = document.getElementById('time');
const timeLabel = document.getElementById('timeLabel');
const uniformReadout = document.getElementById('uniformReadout');

const state = {
    seconds: 0,
    playing: true,
    modeEven: Number(evenMenu.value),
    modeOdd: (TAB === 5) ? Number(evenMenu.value) : Number(oddMenu.value),
    pixel: null,        // { x, y } in window pixels (y up), or null
    fragment: null,     // { triangle, bary } under that pixel, or null
    overlay: null,      // 'triangles', 'evenOdd', 'bary', 'colors' or null
    dirty: true,        // the trace needs to be redone
};

function setPlaying(playing) {
    state.playing = playing;
    playButton.textContent = playing ? 'Pause' : 'Play';
    if (playing) {
        state.pixel = null;
        state.fragment = null;
    }
    state.dirty = true;
}

playButton.addEventListener('click', () => setPlaying(!state.playing));
evenMenu.addEventListener('change', () => {
    state.modeEven = Number(evenMenu.value);
    if (TAB === 5) state.modeOdd = state.modeEven;
    state.dirty = true;
});
oddMenu.addEventListener('change', () => { state.modeOdd = Number(oddMenu.value); state.dirty = true; });
timeSlider.addEventListener('input', () => {
    if (state.playing) setPlaying(false);
    state.seconds = Number(timeSlider.value);
    state.dirty = true;
});

canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = Math.floor((event.clientX - rect.left) * dpr);
    const yDown = Math.floor((event.clientY - rect.top) * dpr);
    state.pixel = { x, y: canvas.height - 1 - yDown };     // WebGL counts y from the bottom
    if (state.playing) {
        state.playing = false;
        playButton.textContent = 'Play';
    }
    state.dirty = true;
});

document.getElementById('foldAll').addEventListener('click', () => setAllFolded(true));
document.getElementById('unfoldAll').addEventListener('click', () => setAllFolded(false));

let lastTime = null;
function frame(now) {
    if (state.playing && lastTime !== null) {
        state.seconds = (state.seconds + (now - lastTime) / 1000) % TIME_MAX;
    }
    lastTime = now;

    const m = matricesAt(state.seconds, canvas.clientWidth / canvas.clientHeight);
    drawCube(m, state.modeEven, state.modeOdd, state.seconds);

    if (state.dirty) {
        state.fragment = state.pixel
            ? pickFragment(m, state.pixel.x, state.pixel.y, canvas.width, canvas.height)
            : null;
        renderTrace(m);           // reads the pixel right after drawing it
        state.dirty = false;
    }
    drawOverlay(m);

    timeSlider.value = state.seconds;
    timeLabel.textContent = f2(state.seconds) + ' s';
    uniformReadout.textContent = (TAB === 5)
        ? `uMode = ${state.modeEven}   uTime = ${f2(state.seconds)}`
        : `uModeEven = ${state.modeEven}   uModeOdd = ${state.modeOdd}   uTime = ${f2(state.seconds)}`;
    requestAnimationFrame(frame);
}

// Fill in the page's tab-specific text: the switch, the header link,
// the file name, and (tab 5) one menu instead of two.
function setUpTab() {
    const info = TAB_INFO[TAB];
    document.title = `Cube Color Code Explorer: Tab ${TAB}`;
    document.getElementById('tab' + TAB + 'Link').classList.add('current');
    const pageLink = document.getElementById('tabPageLink');
    pageLink.href = '../../webGL-examples/examples/cube-color-alternatives/' + info.page;
    pageLink.textContent = info.title + ' of “Ways to Color a Cube”';
    document.getElementById('fileName').textContent = info.file;
    if (TAB === 5) {
        document.getElementById('evenLabel').textContent = 'Rule (uMode):';
        document.getElementById('oddLabel').hidden = true;
        oddMenu.hidden = true;
    }
}

setUpTab();
buildCodePanel();
requestAnimationFrame(frame);
