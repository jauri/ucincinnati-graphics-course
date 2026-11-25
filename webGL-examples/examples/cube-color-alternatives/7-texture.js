// =====================================================================
//  Ways to Color a Cube - 7: A TEXTURE (BRICKS)
// =====================================================================
//
// This is example 7 of 7 in "Ways to Color a Cube":
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
//   6-per-triangle-rules.js    same as 5, but even and odd triangles
//                              each get their own rule, picked with
//                              gl_VertexID
//   7-texture.js               like 3, but each vertex carries a
//                              TEXTURE COORDINATE instead of a color,
//                              and every face shows a brick image
//
// THE BIG IDEA OF THIS EXAMPLE
// ----------------------------
// This file is a copy of example 3 with ONE idea changed. Try it:
//
//     diff 3-face-colors.js 7-texture.js
//
// In example 3, each vertex carried a COLOR (r, g, b). Here each vertex
// carries a TEXTURE COORDINATE (u, v) instead: a position in an image.
// The rasterizer interpolates (u, v) across each triangle exactly as it
// interpolated the color, and the fragment shader uses the interpolated
// (u, v) to LOOK UP the color in the image. So the color can change
// from fragment to fragment far more than any 3 vertex colors could
// make it: the image supplies the detail, the vertices only say where
// the image goes.
//
// WHAT THIS EXAMPLE SHOWS
// -----------------------
// Each face shows the whole brick picture once. The shaders, matrices,
// lighting and animation are the same as example 3.
//
// HOW THE TEXTURE COORDINATE TRAVELS THROUGH THE PIPELINE
// -------------------------------------------------------
//   aTexCoord (attribute, one per vertex)
//      → vertex shader copies it into vTexCoord (a varying)
//      → the RASTERIZER interpolates vTexCoord across the triangle for
//        each fragment
//      → fragment shader reads the texture at vTexCoord, then lights
//        the color it gets back
//
// THE IMAGE
// ---------
// bricks.png is the original picture. The page actually loads the copy
// in bricks-texture.js (scaled to 512 x 512 and stored as text), because
// browsers block WebGL from using an image file when the page is opened
// by double-clicking it. That file explains why.
//
// The sections below are numbered 0-5, in the same order in all seven files.


// ---------------------------------------------------------------------
// 0. Get a WebGL "context" from the <canvas> element in the HTML page.
//    The context (gl) is the object we use to issue every WebGL command.
//    We ask for 'webgl2': WebGL 2, which every current desktop and phone
//    browser supports.
// ---------------------------------------------------------------------
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2');


// ---------------------------------------------------------------------
// 1. SHADERS
//    Shaders are written in GLSL, a C-like language. We store the source
//    code in JavaScript strings, then compile them for the GPU.
//
//    Three kinds of shader variables, in WebGL 2 (GLSL ES 3.00) syntax:
//      in (vertex shader)   - a different value for every vertex, read
//                             from the buffer (an "attribute")
//      uniform              - one value shared by every vertex AND every
//                             fragment in a draw call
//      out (vertex shader) / in (fragment shader)
//                           - passed from the vertex shader to the
//                             fragment shader (a "varying")
//    (WebGL 1 spelled these attribute, uniform and varying, and you will
//    see those keywords in older tutorials. The ideas are the same; only
//    the keywords changed. These comments still say "attribute" and
//    "varying" for the ideas.)
//
//    NEW compared to example 3: instead of a color, each vertex carries
//    a TEXTURE COORDINATE, and the fragment shader looks up the color in
//    an image (a texture) using a new kind of uniform, a sampler.
//
//    The "// language=GLSL" and "/* glsl */" comments below tell your
//    editor to color the string as GLSL (needs a GLSL plugin). They don't
//    change what the program does.
// ---------------------------------------------------------------------

// language=GLSL
const vertexShaderSource = /* glsl */ `#version 300 es
  // ^ "#version 300 es" says "this is WebGL 2 GLSL". It must be the very
  //   first line of the source, so it sits right after the backtick.

  in vec3 aPosition;          // vertex position (model space)
  in vec3 aNormal;            // direction the face is pointing
  in vec2 aTexCoord;          // this vertex's point in the image (u, v: 0..1)

  uniform mat4 uModel;        // rotates the cube (it spins over time)
  uniform mat4 uView;         // where the camera is and where it looks
  uniform mat4 uProjection;   // perspective: far things look smaller

  out vec3 vNormal;           // handed to the fragment shader
  out vec2 vTexCoord;         // handed to the fragment shader

  void main() {
    // Turn the normal the same way the cube is turned. The cube now
    // rotates, so this matters: without it, the lighting would stay glued
    // to the screen instead of to the cube's faces.
    // mat3(uModel) keeps only the rotation part of the 4x4 matrix (it
    // drops the translation). For a pure rotation, that is exactly the
    // right way to turn a normal. (If you stretched the cube unevenly you
    // would need the "inverse transpose" instead, but we don't.)
    vNormal = normalize(mat3(uModel) * aNormal);

    // Pass the texture coordinate along unchanged, exactly as example 3
    // passed the color. The vertex shader runs only once per VERTEX, but
    // the fragment shader runs once per FRAGMENT.
    //
    // A FRAGMENT is a candidate pixel: one triangle's contribution to
    // one pixel. Usually that's one fragment per covered pixel, but where
    // triangles overlap, a pixel gets one fragment from each of them, and
    // the depth test (section 4) decides which one is kept.
    //
    // Between the two shaders, the RASTERIZER finds every fragment inside
    // the triangle and fills in its (u, v) by interpolating the three
    // vertex values using BARYCENTRIC coordinates (weights that say how
    // close the fragment is to each vertex). This happens to every
    // varying, automatically. A fragment halfway along an edge from
    // (0,0) to (1,0) gets (0.5, 0): the middle of the image's bottom edge.
    vTexCoord = aTexCoord;

    // model -> world -> view (camera) -> clip space.
    // (After the vertex shader, the GPU divides by w and the viewport
    // maps the result onto the canvas's pixels; see section 4.)
    // Read right to left: first turn the cube (uModel), then view it from
    // the camera (uView), then apply perspective (uProjection).
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
  }
`;

// language=GLSL
const fragmentShaderSource = /* glsl */ `#version 300 es
  precision mediump float;    // how accurate floating-point numbers are
                              // (medium is plenty)

  in vec3 vNormal;            // received from the vertex shader (interpolated)
  in vec2 vTexCoord;          // received from the vertex shader (interpolated)

  // A SAMPLER is a uniform that stands for a texture. sampler2D means a
  // flat 2D image. JavaScript sets it to a texture unit number (section 2).
  uniform sampler2D uTexture;

  // WebGL 2 has no built-in gl_FragColor. Instead we declare our own
  // output, and whatever main() writes into it becomes this fragment's
  // color.
  out vec4 fragColor;

  void main() {
    // This runs once for EVERY FRAGMENT inside each triangle. vTexCoord
    // and vNormal have already been interpolated between the triangle's
    // three vertices, so each fragment gets its own (u, v): its own point
    // in the image.

    // texture() SAMPLES the image: it looks up the color at (u, v),
    // using the filtering set up in section 2. It returns a vec4
    // (r, g, b, a); we keep r, g, b.
    vec3 brickColor = texture(uTexture, vTexCoord).rgb;

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

    // fragColor is our output (declared above): this fragment's color. If
    // the fragment passes the depth test, it becomes the pixel's color.
    // Multiplying the brick color by light darkens it on dim faces.
    fragColor = vec4(brickColor * light, 1.0);  // 1.0 = fully opaque
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
// 2. CUBE GEOMETRY → BUFFER, AND THE TEXTURE
//
//    One cube, 1 unit wide, CENTERED on the origin: every coordinate is
//    -0.5 or +0.5. Centering it makes it spin around its middle.
//
//    Each face = 2 triangles = 6 vertices, so 6 faces = 36 vertices.
//    Each vertex now has 8 numbers:
//         x,    y,    z,      nx, ny, nz,      u,   v
//        (position)          (normal)         (texture coordinate)
//
//    Compare with example 3: the 3 color numbers (r, g, b) are replaced
//    by 2 TEXTURE COORDINATES (u, v). They say which point of the image
//    belongs at this vertex:
//
//        (0,1) +---------+ (1,1)       u runs left → right, 0 to 1
//              |  image  |             v runs bottom → top, 0 to 1
//        (0,0) +---------+ (1,0)
//
//    Every face gets the four image corners at its four cube corners, so
//    each face shows the whole picture once. For each face, (0,0) goes at
//    the cube corner that is bottom-left when you look at that face from
//    outside the cube (with +y up, or -z up for the top face and +z up
//    for the bottom face). That keeps the bricks upright on the four
//    side faces.
//
//    WHY 36 VERTICES AND NOT JUST 8 CORNERS?
//    Same reason as example 3. A cube has only 8 corners, but each
//    corner touches 3 faces, and it is a DIFFERENT image corner on each
//    of them (and has a different normal). So each corner position is
//    stored 3 times - once per face - with different (u, v) each time.
// ---------------------------------------------------------------------

const cubeVertices = new Float32Array([
    // Front face (normal points toward +z)
    -0.5, -0.5,  0.5,    0,  0,  1,   0, 0,
     0.5, -0.5,  0.5,    0,  0,  1,   1, 0,
     0.5,  0.5,  0.5,    0,  0,  1,   1, 1,
    -0.5, -0.5,  0.5,    0,  0,  1,   0, 0,
     0.5,  0.5,  0.5,    0,  0,  1,   1, 1,
    -0.5,  0.5,  0.5,    0,  0,  1,   0, 1,

    // Back face (-z)
    -0.5, -0.5, -0.5,    0,  0, -1,   1, 0,
     0.5,  0.5, -0.5,    0,  0, -1,   0, 1,
     0.5, -0.5, -0.5,    0,  0, -1,   0, 0,
    -0.5, -0.5, -0.5,    0,  0, -1,   1, 0,
    -0.5,  0.5, -0.5,    0,  0, -1,   1, 1,
     0.5,  0.5, -0.5,    0,  0, -1,   0, 1,

    // Top face (+y)
    -0.5,  0.5, -0.5,    0,  1,  0,   0, 1,
    -0.5,  0.5,  0.5,    0,  1,  0,   0, 0,
     0.5,  0.5,  0.5,    0,  1,  0,   1, 0,
    -0.5,  0.5, -0.5,    0,  1,  0,   0, 1,
     0.5,  0.5,  0.5,    0,  1,  0,   1, 0,
     0.5,  0.5, -0.5,    0,  1,  0,   1, 1,

    // Bottom face (-y)
    -0.5, -0.5, -0.5,    0, -1,  0,   0, 0,
     0.5, -0.5,  0.5,    0, -1,  0,   1, 1,
    -0.5, -0.5,  0.5,    0, -1,  0,   0, 1,
    -0.5, -0.5, -0.5,    0, -1,  0,   0, 0,
     0.5, -0.5, -0.5,    0, -1,  0,   1, 0,
     0.5, -0.5,  0.5,    0, -1,  0,   1, 1,

    // Right face (+x)
     0.5, -0.5, -0.5,    1,  0,  0,   1, 0,
     0.5,  0.5, -0.5,    1,  0,  0,   1, 1,
     0.5,  0.5,  0.5,    1,  0,  0,   0, 1,
     0.5, -0.5, -0.5,    1,  0,  0,   1, 0,
     0.5,  0.5,  0.5,    1,  0,  0,   0, 1,
     0.5, -0.5,  0.5,    1,  0,  0,   0, 0,

    // Left face (-x)
    -0.5, -0.5, -0.5,   -1,  0,  0,   0, 0,
    -0.5,  0.5,  0.5,   -1,  0,  0,   1, 1,
    -0.5,  0.5, -0.5,   -1,  0,  0,   0, 1,
    -0.5, -0.5, -0.5,   -1,  0,  0,   0, 0,
    -0.5, -0.5,  0.5,   -1,  0,  0,   1, 0,
    -0.5,  0.5,  0.5,   -1,  0,  0,   1, 1,
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
// which are the normal, and which are the texture coordinate.
//   stride = bytes from one vertex to the next = 8 floats × 4 bytes = 32
//   offset = where in each vertex this attribute starts
const BYTES_PER_FLOAT = 4;
const stride = 8 * BYTES_PER_FLOAT;

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
//   | x | y | z | nx| ny| nz| u | v |
//   0   4   8   12  16  20  24  28  32   <- byte offsets
//   ^aPosition  ^aNormal    ^aTexCoord

// aPosition: the first 3 numbers of each vertex (x, y, z), offset 0.
const aPosition = gl.getAttribLocation(program, 'aPosition');
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0);

// aNormal: the next 3 numbers (nx, ny, nz), so skip past the 3 position
// floats = 12 bytes into each vertex.
const aNormal = gl.getAttribLocation(program, 'aNormal');
gl.enableVertexAttribArray(aNormal);
gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, stride, 3 * BYTES_PER_FLOAT);

// aTexCoord: the last 2 numbers (u, v), so skip past position AND
// normal: 6 floats = 24 bytes into each vertex. Note the 2: a texture
// coordinate has two numbers, not three.
const aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
gl.enableVertexAttribArray(aTexCoord);
gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, stride, 6 * BYTES_PER_FLOAT);

// Look up where each uniform lives so we can set it later.
// Unlike attributes, uniforms don't come from the buffer: we send their
// values directly from JavaScript (gl.uniformMatrix4fv) in draw().
// These variables hold a LOCATION (an address in the program), not the
// value itself.
//   uModel      - per frame: the cube's current rotation
//   uView       - per frame: the camera's position and direction
//   uProjection - per frame: perspective (far things look smaller)
//   uTexture    - once, below: which texture unit to sample from
const uModel = gl.getUniformLocation(program, 'uModel');
const uView = gl.getUniformLocation(program, 'uView');
const uProjection = gl.getUniformLocation(program, 'uProjection');
const uTexture = gl.getUniformLocation(program, 'uTexture');

// ---- The texture -----------------------------------------------------
// NEW in this example. A TEXTURE is an image stored in GPU memory that
// shaders can read from. Setting one up takes four steps:
//
//   1. createTexture / bindTexture - make a texture and make it the
//      "current" one (like createBuffer / bindBuffer above). The next
//      texture commands act on whichever texture is bound.
//   2. texImage2D - copy pixels into it.
//   3. texParameteri / generateMipmap - say how to read between and
//      across pixels (filtering) and what to do outside 0..1 (wrapping).
//   4. Tell the sampler uniform which TEXTURE UNIT to read. A texture
//      unit is a numbered slot the texture is bound to. We only use one
//      texture, so we use unit 0 (TEXTURE0, the default).
//
// Loading an image takes time, and draw() starts right away. So we first
// fill the texture with a single gray pixel, and replace it with the
// bricks when the image has finished loading.
const texture = gl.createTexture();
gl.activeTexture(gl.TEXTURE0);           // work with texture unit 0
gl.bindTexture(gl.TEXTURE_2D, texture);  // put our texture in that unit

// Placeholder: a 1 x 1 texture holding one gray pixel (r, g, b, a as
// bytes 0..255). Every texture coordinate reads this same pixel.
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
              new Uint8Array([128, 128, 128, 255]));

// The sampler uTexture reads from texture unit 0. (0 is also the default
// value, but saying it makes the connection visible.) Uniforms keep their
// value, so we set this once, here, instead of in draw().
gl.uniform1i(uTexture, 0);

// Load the brick picture. BRICKS_DATA_URL comes from bricks-texture.js,
// which the HTML page loads before this file. It is the image file
// stored as text: see that file for why we don't load bricks.png
// directly (short version: browsers block it on file:// pages).
const image = new Image();
image.onload = function () {
    // This function runs later, once the image is decoded.
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Images are stored top row first, but texture coordinates put
    // v = 0 at the BOTTOM. Flipping the rows while uploading makes
    // v = 0 the bottom of the picture, so the bricks are not upside down.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // Copy the image's pixels into the texture (replacing the gray pixel).
    // Level 0 is the full-size image.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // MIPMAPS are smaller copies of the image (1/2, 1/4, 1/8 ... size).
    // When the cube is small or a face is seen at a steep angle, many
    // texture pixels land in one fragment; reading a smaller copy avoids
    // flickering and moire patterns. generateMipmap builds them all.
    gl.generateMipmap(gl.TEXTURE_2D);

    // MIN_FILTER: what to do when the texture is shrunk on screen. This
    // setting picks the two closest mipmap sizes and interpolates
    // linearly within and between them (the smoothest option).
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    // MAG_FILTER: what to do when the texture is enlarged. LINEAR
    // interpolates the 4 nearest texture pixels; NEAREST would show
    // blocky squares.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // (Wrapping - what happens for u or v outside 0..1 - does not
    // matter here, because every coordinate in the buffer is 0 or 1.
    // The default, REPEAT, tiles the image.)
};
image.src = BRICKS_DATA_URL;   // start loading; onload runs when done


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

    // The actual draw call: "read VERTEX_COUNT (36) vertices from the
    // buffer, starting at vertex 0, and treat every 3 as a triangle."
    // For this call the GPU:
    //   1. runs the vertex shader once per vertex (36 times) to find
    //      where each vertex lands on the screen
    //   2. RASTERIZES: finds the fragments each triangle covers, and
    //      interpolates
    //      the varyings (vTexCoord, vNormal) for each of those fragments
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
const SPIN_SPEED = 0.3;   // radians per second (a full turn takes ~21 s)

function animate(timeInMilliseconds) {
    const seconds = timeInMilliseconds / 1000;
    draw(seconds * SPIN_SPEED);
    requestAnimationFrame(animate);   // ask to be called again next frame
}

// Start the loop. Because we redraw every frame, window resizes are
// handled automatically by step a in draw().
requestAnimationFrame(animate);
