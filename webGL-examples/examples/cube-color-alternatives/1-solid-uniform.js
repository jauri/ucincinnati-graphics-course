// =====================================================================
//  Ways to Color a Cube - 1: ONE SOLID COLOR, AS A UNIFORM
// =====================================================================
//
// This is example 1 of 5 in "Ways to Color a Cube":
//
//   1-solid-uniform.js         ONE color for the whole cube, sent as a
//                              UNIFORM
//   2-solid-attribute.js       the same picture, but the color is stored
//                              with EVERY vertex, as an ATTRIBUTE
//   3-face-colors.js           each FACE has its own color
//   4-vertex-interpolation.js  each CUBE CORNER has its own color, and
//                              the rasterizer interpolates them across
//                              every triangle
//   5-custom-interpolation.js  same colors as 4, but the fragment shader
//                              does the interpolation itself
//
// HOW THE FIVE EXAMPLES FIT TOGETHER
// ----------------------------------
// Each step changes ONE thing:
//   1 → 2  the color moves from a uniform into the vertex data
//          (the CODE changes; the picture stays exactly the same)
//   2 → 3  different colors in the data (the code stays the same)
//   3 → 4  different colors in the data again
//   4 → 5  the fragment shader takes over the interpolation
//
// Compare any two neighbors with diff, for example
//
//     diff 1-solid-uniform.js 2-solid-attribute.js
//
// (Yes, about 95% of this file is copied into the others. That is on
// purpose: each file is a complete program you can read top to bottom.)
//
// WHAT THIS EXAMPLE SHOWS
// -----------------------
// The whole cube is one color, CUBE_COLOR, and the color is a UNIFORM
// (uColor): ONE value for the whole draw call, sent from JavaScript.
// This is how example-cube.js colored its cubes.
//
// The vertex data holds only positions and normals. There is no color in
// it at all. uColor is not a varying, so the rasterizer has nothing to
// interpolate for it: every fragment of the cube reads the same uColor.
//
// WHY A UNIFORM?
// --------------
// When a value is the same for a whole object, a uniform is the natural
// fit: we send 3 numbers once, instead of copying the same 3 numbers into
// all 36 vertices (108 numbers). The catch: a uniform CAN'T change from
// one vertex to the next. To give each face or corner its own color, the
// color has to move into the vertex data, as an attribute. That is what
// example 2 does.
//
// The three kinds of shader variables differ in HOW OFTEN they change:
//   uniform   - once per draw call (the same for the whole cube)
//   attribute - once per vertex   (read from the buffer)
//   varying   - once per fragment (interpolated by the rasterizer)
//
// Notice that the faces still look different from each other. That is
// the LIGHTING (section 1, fragment shader), not the color: each face
// points a different way, so it catches a different amount of light.
// Without lighting, this cube would be a flat orange silhouette.
//
// HOW THE COLOR TRAVELS THROUGH THE PIPELINE
// ------------------------------------------
//   CUBE_COLOR (a JavaScript constant)
//      → sent to the GPU as the uniform uColor (in draw())
//      → the fragment shader reads uColor directly and lights it
//        (no vertex shader, no rasterizer, no interpolation involved)
//
// The sections below follow the same numbered order as example-cube.js.


// ---------------------------------------------------------------------
// 0. Get a WebGL "context" from the <canvas> element in the HTML page.
//    The context (gl) is the object we use to issue every WebGL command.
// ---------------------------------------------------------------------
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl');


// ---------------------------------------------------------------------
// 1. SHADERS
//    Shaders are written in GLSL, a C-like language. We store the source
//    code in JavaScript strings, then compile them for the GPU.
//
//    Three kinds of shader variables:
//      attribute - a different value for every vertex (e.g. its position)
//      uniform   - one value shared by every vertex AND every fragment
//                  in a draw call
//      varying   - passed from the vertex shader to the fragment shader
//
//    As in example-cube.js, the color is a UNIFORM (uColor): one color
//    for the whole cube. It is only used in the fragment shader.
//
//    The "// language=GLSL" and "/* glsl */" comments below tell your
//    editor to color the string as GLSL (needs a GLSL plugin). They don't
//    change what the program does.
// ---------------------------------------------------------------------

// language=GLSL
const vertexShaderSource = /* glsl */ `
  attribute vec3 aPosition;   // vertex position (model space)
  attribute vec3 aNormal;     // direction the face is pointing

  uniform mat4 uModel;        // rotates the cube (it spins over time)
  uniform mat4 uView;         // where the camera is and where it looks
  uniform mat4 uProjection;   // perspective: far things look smaller

  varying vec3 vNormal;       // handed to the fragment shader

  void main() {
    // Turn the normal the same way the cube is turned. The cube now
    // rotates, so this matters: without it, the lighting would stay glued
    // to the screen instead of to the cube's faces.
    // mat3(uModel) keeps only the rotation part of the 4x4 matrix (it
    // drops the translation). For a pure rotation, that is exactly the
    // right way to turn a normal. (If you stretched the cube unevenly you
    // would need the "inverse transpose" instead, but we don't.)
    vNormal = normalize(mat3(uModel) * aNormal);

    // (There is no color here: the color is a uniform, and only the
    // fragment shader needs it.)
    //
    // The vertex shader runs only once per VERTEX, but the fragment
    // shader runs once per FRAGMENT.
    //
    // A FRAGMENT is a candidate pixel: one triangle's contribution to
    // one pixel. Usually that's one fragment per covered pixel, but where
    // triangles overlap, a pixel gets one fragment from each of them, and
    // the depth test (section 4) decides which one is kept.
    //
    // Between the two shaders, the RASTERIZER finds every fragment inside
    // the triangle and fills in each VARYING by interpolating its three
    // vertex values using BARYCENTRIC coordinates (weights that say how
    // close the fragment is to each vertex). Here the only varying is
    // vNormal.

    // model -> world -> view (camera) -> clip space.
    // (After the vertex shader, the GPU divides by w and the viewport
    // maps the result onto the canvas's pixels; see section 4.)
    // Read right to left: first turn the cube (uModel), then view it from
    // the camera (uView), then apply perspective (uProjection).
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
  }
`;

// language=GLSL
const fragmentShaderSource = /* glsl */ `
  precision mediump float;    // how accurate floating-point numbers are
                              // (medium is plenty)

  varying vec3 vNormal;       // received from the vertex shader (interpolated)
  uniform vec3 uColor;        // the cube's color, set from JavaScript:
                              // the SAME for every fragment

  void main() {
    // This runs once for EVERY FRAGMENT inside each triangle. vNormal has
    // already been interpolated between the triangle's three vertices, so
    // each fragment gets its own value. uColor is a uniform, so every
    // fragment gets the same color.

    // Simple lighting so we can tell the faces of the cube apart.
    // The light shines from above and slightly to the side.
    vec3 lightDirection = normalize(vec3(0.5, 1.0, 0.3));

    // dot() measures how closely two directions line up:
    //   1 = the face points straight at the light (brightest)
    //   0 = the face is sideways to the light
    //   negative = the face points away, so max() clamps it to 0 (dark)
    float brightness = max(dot(vNormal, lightDirection), 0.0);

    // Keep 30% "ambient" light so faces in shadow aren't pure black.
    float light = 0.3 + 0.7 * brightness;

    // gl_FragColor is the built-in output: this fragment's color. If the
    // fragment passes the depth test, it becomes the pixel's color.
    // Multiplying the color by light darkens it on dim faces.
    gl_FragColor = vec4(uColor * light, 1.0);   // 1.0 = fully opaque
  }
`;

// Compile one shader and report any GLSL errors.
function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

// A "program" for the GPU
// is a vertex shader + a fragment shader linked together.
const program = gl.createProgram();
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShaderSource));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
gl.linkProgram(program);
gl.useProgram(program);


// ---------------------------------------------------------------------
// 2. CUBE GEOMETRY → BUFFER
//
//    One cube, 1 unit wide, CENTERED on the origin: every coordinate is
//    -0.5 or +0.5. (In example-cube.js the cube sat on the ground at
//    y = 0. Centering it makes it spin around its middle.)
//
//    Each face = 2 triangles = 6 vertices, so 6 faces = 36 vertices.
//    Each vertex has 6 numbers:
//         x,    y,    z,      nx, ny, nz
//        (position)          (normal)
//
//    NO COLOR in the vertex data: the color is the uniform uColor, which
//    draw() sets to CUBE_COLOR. Try changing CUBE_COLOR to another
//    [r, g, b] value between 0 and 1.
// ---------------------------------------------------------------------

// One color for the whole cube: (red, green, blue), each from 0 to 1.
// (Used in draw(), not in the vertex data below.)
const CUBE_COLOR = [1.0, 0.5, 0.1];   // orange

const cubeVertices = new Float32Array([
    // Front face (normal points toward +z)
    -0.5, -0.5,  0.5,    0,  0,  1,
     0.5, -0.5,  0.5,    0,  0,  1,
     0.5,  0.5,  0.5,    0,  0,  1,
    -0.5, -0.5,  0.5,    0,  0,  1,
     0.5,  0.5,  0.5,    0,  0,  1,
    -0.5,  0.5,  0.5,    0,  0,  1,

    // Back face (-z)
    -0.5, -0.5, -0.5,    0,  0, -1,
     0.5,  0.5, -0.5,    0,  0, -1,
     0.5, -0.5, -0.5,    0,  0, -1,
    -0.5, -0.5, -0.5,    0,  0, -1,
    -0.5,  0.5, -0.5,    0,  0, -1,
     0.5,  0.5, -0.5,    0,  0, -1,

    // Top face (+y)
    -0.5,  0.5, -0.5,    0,  1,  0,
    -0.5,  0.5,  0.5,    0,  1,  0,
     0.5,  0.5,  0.5,    0,  1,  0,
    -0.5,  0.5, -0.5,    0,  1,  0,
     0.5,  0.5,  0.5,    0,  1,  0,
     0.5,  0.5, -0.5,    0,  1,  0,

    // Bottom face (-y)
    -0.5, -0.5, -0.5,    0, -1,  0,
     0.5, -0.5,  0.5,    0, -1,  0,
    -0.5, -0.5,  0.5,    0, -1,  0,
    -0.5, -0.5, -0.5,    0, -1,  0,
     0.5, -0.5, -0.5,    0, -1,  0,
     0.5, -0.5,  0.5,    0, -1,  0,

    // Right face (+x)
     0.5, -0.5, -0.5,    1,  0,  0,
     0.5,  0.5, -0.5,    1,  0,  0,
     0.5,  0.5,  0.5,    1,  0,  0,
     0.5, -0.5, -0.5,    1,  0,  0,
     0.5,  0.5,  0.5,    1,  0,  0,
     0.5, -0.5,  0.5,    1,  0,  0,

    // Left face (-x)
    -0.5, -0.5, -0.5,   -1,  0,  0,
    -0.5,  0.5,  0.5,   -1,  0,  0,
    -0.5,  0.5, -0.5,   -1,  0,  0,
    -0.5, -0.5, -0.5,   -1,  0,  0,
    -0.5, -0.5,  0.5,   -1,  0,  0,
    -0.5,  0.5,  0.5,   -1,  0,  0,
]);
const VERTEX_COUNT = 36;

// Copy the vertex data into GPU memory.
//   createBuffer - reserve a new, empty buffer on the GPU
//   bindBuffer   - make it the "current" buffer; the next buffer
//                  commands act on whichever buffer is bound
//                  (ARRAY_BUFFER means "this holds vertex data")
//   bufferData   - copy our numbers into it. STATIC_DRAW is a hint
//                  that we'll fill it once and draw from it many times.
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

// Tell the GPU how to read the buffer: which numbers are the position,
// and which are the normal.
//   stride = bytes from one vertex to the next = 6 floats × 4 bytes = 24
//   offset = where in each vertex this attribute starts
const BYTES_PER_FLOAT = 4;
const stride = 6 * BYTES_PER_FLOAT;

// Each attribute is hooked up in three steps:
//   getAttribLocation       - ask the linked program for the attribute's
//                             slot number (the JS variable holds that
//                             number, not the data itself)
//   enableVertexAttribArray - say "fill this attribute from a buffer"
//   vertexAttribPointer     - say HOW: read from the currently bound
//                             buffer, 3 numbers per vertex, as floats,
//                             not normalized, stepping `stride` bytes
//                             per vertex, starting at this offset
//
// One vertex in memory (each box is one 4-byte float):
//   | x | y | z | nx| ny| nz|
//   0   4   8   12  16  20  24   <- byte offsets
//   ^aPosition  ^aNormal

// aPosition: the first 3 numbers of each vertex (x, y, z), offset 0.
const aPosition = gl.getAttribLocation(program, 'aPosition');
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0);

// aNormal: the next 3 numbers (nx, ny, nz), so skip past the 3 position
// floats = 12 bytes into each vertex.
const aNormal = gl.getAttribLocation(program, 'aNormal');
gl.enableVertexAttribArray(aNormal);
gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, stride, 3 * BYTES_PER_FLOAT);

// Look up where each uniform lives so we can set it later.
// Unlike attributes, uniforms don't come from the buffer: we send their
// values directly from JavaScript (gl.uniformMatrix4fv, gl.uniform3fv)
// in draw().
// These variables hold a LOCATION (an address in the program), not the
// value itself.
//   uModel      - per frame: the cube's current rotation
//   uView       - per frame: the camera's position and direction
//   uProjection - per frame: perspective (far things look smaller)
//   uColor      - the cube's color
const uModel = gl.getUniformLocation(program, 'uModel');
const uView = gl.getUniformLocation(program, 'uView');
const uProjection = gl.getUniformLocation(program, 'uProjection');
const uColor = gl.getUniformLocation(program, 'uColor');


// ---------------------------------------------------------------------
// 3. MATRIX HELPERS
//    A 4×4 matrix can move, scale, or rotate points. WebGL stores
//    matrices as 16 numbers in "column-major" order: the first 4 numbers
//    are the first COLUMN, not the first row.
//
//    (Real projects usually use a library such as glMatrix for this.)
// ---------------------------------------------------------------------

// Rotate a point by `angle` radians around the x axis (tips forward/back).
// In column-major order, each line below is one COLUMN of the matrix.
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

// Rotate a point by `angle` radians around the y axis (spins like a top).
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

// Multiply two matrices: the result does b first, then a.
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

// Perspective projection: makes far-away objects look smaller.
//   fieldOfView - how wide the camera sees, in radians
//   aspect      - canvas width / height, so things aren't stretched
//   near, far   - nothing closer than near or farther than far is drawn
function perspective(fieldOfView, aspect, near, far) {
    const f = 1 / Math.tan(fieldOfView / 2);
    return [
        f / aspect, 0, 0,                               0,
        0,          f, 0,                               0,
        0,          0, (far + near) / (near - far),    -1,
        0,          0, (2 * far * near) / (near - far), 0,
    ];
}

// Camera matrix: place a camera at `eye`, looking at `target`.
// `up` says which way is "up" for the camera (normally +y).
function lookAt(eye, target, up) {
    const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
    const normalize = (a) => {
        const length = Math.hypot(a[0], a[1], a[2]);
        return [a[0] / length, a[1] / length, a[2] / length];
    };

    // Build the camera's own three axes:
    const zAxis = normalize(subtract(eye, target)); // points backward, away from what we look at
    const xAxis = normalize(cross(up, zAxis));      // points to the camera's right
    const yAxis = cross(zAxis, xAxis);              // points to the camera's up

    return [
        xAxis[0], yAxis[0], zAxis[0], 0,
        xAxis[1], yAxis[1], zAxis[1], 0,
        xAxis[2], yAxis[2], zAxis[2], 0,
        -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
    ];
}


// ---------------------------------------------------------------------
// 4. DRAW
//    Everything above was SETUP: it ran once and got the shaders and the
//    buffer ready. draw() produces ONE picture of the cube, turned by
//    `angle` radians. It follows the same steps every time:
//
//      a. size the drawing area to match the window
//      b. wipe the previous picture
//      c. set the camera
//      d. set the cube's rotation, then tell the GPU to draw
// ---------------------------------------------------------------------
function draw(angle) {
    // --- a. Size the drawing area -------------------------------------
    // A canvas has two sizes: how big it looks on the page (set by CSS),
    // and how many pixels it actually has. If they don't match, the
    // picture gets stretched and blurry, so we make them match.
    // (We only touch them when they differ, because resizing a canvas
    // every frame is wasteful.)
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }

    // The viewport tells WebGL which rectangle of the canvas to draw
    // into. After projection, the shader's output positions run from -1
    // to +1 on each axis; the viewport maps that range onto real pixels
    // (here, the whole canvas).
    gl.viewport(0, 0, canvas.width, canvas.height);

    // --- b. Wipe the previous picture ---------------------------------
    // clearColor only CHOOSES the color to clear with: a very dark gray
    // (red, green, blue, alpha), so even a black cube corner stays visible.
    // Nothing is cleared until gl.clear().
    gl.clearColor(0.12, 0.12, 0.12, 1);

    // Depth testing makes the near faces of the cube hide the far ones,
    // no matter which order the triangles are drawn in.
    //
    // How it works: alongside the colors, WebGL keeps a DEPTH BUFFER that
    // stores, for every pixel, how far away the closest thing drawn there
    // so far is. When a new fragment arrives, WebGL compares its distance to
    // the stored one and only keeps it if it is closer.
    gl.enable(gl.DEPTH_TEST);

    // Erase both the colors and the depth info (to "nothing drawn yet")
    // so the last picture doesn't leak into this one.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // --- c. Set the camera --------------------------------------------
    // Projection: a 45° (PI / 4) field of view, the canvas's aspect ratio
    // so the cube isn't squashed, and a visible range from 0.1 to 100
    // units away from the camera. Anything outside that range is not drawn.
    const aspect = canvas.width / canvas.height;
    gl.uniformMatrix4fv(uProjection, false, perspective(Math.PI / 4, aspect, 0.1, 100));

    // View: the camera sits 3 units in front of the cube at (0, 0, 3),
    // looks at the cube's center (0, 0, 0), and +y is "up".
    //
    // (The `false` argument means "don't transpose the matrix".
    // WebGL requires it to be false.)
    gl.uniformMatrix4fv(uView, false, lookAt([0, 0, 3], [0, 0, 0], [0, 1, 0]));

    // --- d. Draw the cube ---------------------------------------------
    // Build the cube's model matrix: tip it around x, then spin it
    // around y. (In multiply(a, b), b happens first.) Spinning around x
    // a bit slower (0.7×) than around y makes the cube tumble, so over
    // time we get to see all 6 faces.
    const model = multiply(rotationY(angle), rotationX(0.7 * angle));
    gl.uniformMatrix4fv(uModel, false, model);

    // Set the cube's color. 3fv = "a vector of 3 floats".
    // (The color never changes, so we could set it just once during
    // setup: a uniform keeps its value until we change it. We set it here
    // to show that uniforms are set from JavaScript, per draw call.)
    gl.uniform3fv(uColor, CUBE_COLOR);

    // The actual draw call: "read VERTEX_COUNT (36) vertices from the
    // buffer, starting at vertex 0, and treat every 3 as a triangle."
    // For this call the GPU:
    //   1. runs the vertex shader once per vertex (36 times) to find
    //      where each vertex lands on the screen
    //   2. RASTERIZES: finds the fragments each triangle covers, and
    //      interpolates
    //      the varyings (here just vNormal) for each of those fragments
    //   3. runs the fragment shader once per fragment to color it
    //   4. uses the depth test to keep only the closest fragment at each
    //      pixel
    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
}


// ---------------------------------------------------------------------
// 5. ANIMATE
//    requestAnimationFrame(f) asks the browser: "call f just before you
//    next paint the screen" (usually 60 times a second). Calling it
//    again from inside f makes a loop: draw, wait for the next frame,
//    draw again, ...
//
//    The angle comes from the ELAPSED TIME, not from counting frames.
//    A fast computer draws more frames per second than a slow one, but
//    the cube still turns at the same speed on both.
// ---------------------------------------------------------------------
const SPIN_SPEED = 0.8;   // radians per second (a full turn takes ~8 s)

function animate(timeInMilliseconds) {
    const seconds = timeInMilliseconds / 1000;
    draw(seconds * SPIN_SPEED);
    requestAnimationFrame(animate);   // ask to be called again next frame
}

// Start the loop. Because we redraw every frame, window resizes are
// handled automatically by step a in draw().
requestAnimationFrame(animate);
