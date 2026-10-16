// =====================================================================
//  Ways to Color a Cube - 5: THE FRAGMENT SHADER DOES ITS OWN INTERPOLATION
// =====================================================================
//
// This is example 5 of 5 in "Ways to Color a Cube":
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
// HOW THIS ONE IS DIFFERENT
// -------------------------
// Examples 2-4 share the same code and only change the data. This one
// breaks that rule on purpose: the shaders and the buffer layout change.
// The diff worth reading is
//
//     diff 4-vertex-interpolation.js 5-custom-interpolation.js
//
// It shows exactly what moves out of the GPU's hardware and into our
// own shader code.
//
// WHAT THIS EXAMPLE SHOWS
// -----------------------
// In example 4, the RASTERIZER interpolated the three vertex colors of
// each triangle with barycentric weights, and we only read about it in the
// comments. Here the fragment shader does that interpolation itself:
//
//     color = λ0·C0 + λ1·C1 + λ2·C2
//
// With the "linear" rule the cube looks exactly like example 4. That
// shows the hardware was doing this math all along. Then try the other
// rules from the menu on the page, or write your own in interpolate()
// (in the fragment shader below).
//
// THE PROBLEM, AND THE TRICK
// --------------------------
// A fragment shader never sees the three vertices of its triangle. It
// only gets varyings, already interpolated for its fragment. So how can
// it know the three vertex colors and its own weights? Two tricks:
//
//   1. Give each vertex its own BARYCENTRIC COORDINATES as an attribute:
//      (1,0,0) for the triangle's 1st vertex, (0,1,0) for the 2nd and
//      (0,0,1) for the 3rd. The rasterizer interpolates them like any
//      varying, and the result at a fragment is exactly that fragment's
//      barycentric coordinates (λ0, λ1, λ2). The rasterizer hands us the
//      weights for free.
//
//   2. Give EVERY vertex of a triangle all THREE vertex colors. The three
//      vertices carry identical values, and interpolating three identical
//      values gives back that same value, so the colors reach the
//      fragment shader unchanged. (Same reason the color in example 2
//      never changed: it was interpolated too, but there was nothing to
//      mix.)
//
// HOW THE DATA TRAVELS THROUGH THE PIPELINE
// -----------------------------------------
//   aBary, aColor0, aColor1, aColor2 (attributes, one set per vertex)
//      → vertex shader copies them into varyings
//      → the RASTERIZER interpolates them: vBary becomes this fragment's
//        weights, vColor0/1/2 come through unchanged
//      → fragment shader calls interpolate(weights, colors), then lights it
//
// (Desktop OpenGL/Direct3D could do this with a GEOMETRY SHADER, which
// sees a whole triangle at once. Newer APIs even let a fragment shader
// read each vertex's value directly. WebGL has neither, so this
// attribute trick is how it is done in the browser.)
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
//    NEW compared to example 4: instead of one aColor per vertex, each
//    vertex carries its barycentric coordinates (aBary) and the colors
//    of ALL THREE vertices of its triangle (aColor0, aColor1, aColor2).
//    The fragment shader gets a uniform, uMode, that picks the interpolation
//    rule.
//
//    The "// language=GLSL" and "/* glsl */" comments below tell your
//    editor to color the string as GLSL (needs a GLSL plugin). They don't
//    change what the program does.
// ---------------------------------------------------------------------

// language=GLSL
const vertexShaderSource = /* glsl */ `
  attribute vec3 aPosition;   // vertex position (model space)
  attribute vec3 aNormal;     // direction the face is pointing
  attribute vec3 aBary;       // (1,0,0), (0,1,0) or (0,0,1): this vertex's
                              // barycentric coordinates
  attribute vec3 aColor0;     // color of the triangle's 1st vertex
  attribute vec3 aColor1;     // color of the triangle's 2nd vertex
  attribute vec3 aColor2;     // color of the triangle's 3rd vertex
                              // (all 3 vertices of a triangle carry the
                              // SAME three colors)

  uniform mat4 uModel;        // rotates the cube (it spins over time)
  uniform mat4 uView;         // where the camera is and where it looks
  uniform mat4 uProjection;   // perspective: far things look smaller

  varying vec3 vNormal;       // handed to the fragment shader
  varying vec3 vBary;         // handed on, becomes the fragment's weights
  varying vec3 vColor0;       // handed on unchanged (see below)
  varying vec3 vColor1;
  varying vec3 vColor2;

  void main() {
    // Turn the normal the same way the cube is turned. The cube now
    // rotates, so this matters: without it, the lighting would stay glued
    // to the screen instead of to the cube's faces.
    // mat3(uModel) keeps only the rotation part of the 4x4 matrix (it
    // drops the translation). For a pure rotation, that is exactly the
    // right way to turn a normal. (If you stretched the cube unevenly you
    // would need the "inverse transpose" instead, but we don't.)
    vNormal = normalize(mat3(uModel) * aNormal);

    // The rasterizer will interpolate every varying across the triangle using
    // barycentric weights (λ0, λ1, λ2). We use that to our advantage:
    //
    // vBary: the three vertices send (1,0,0), (0,1,0) and (0,0,1). The
    // result at a fragment is λ0·(1,0,0) + λ1·(0,1,0) + λ2·(0,0,1)
    // = (λ0, λ1, λ2). So the fragment shader receives its own weights.
    vBary = aBary;

    // vColor0/1/2: all three vertices send the SAME value, and
    // λ0·C + λ1·C + λ2·C = (λ0 + λ1 + λ2)·C = C. Interpolating changes
    // nothing, so these arrive in the fragment shader exactly as given.
    vColor0 = aColor0;
    vColor1 = aColor1;
    vColor2 = aColor2;

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
  varying vec3 vBary;         // this fragment's weights (λ0, λ1, λ2)
  varying vec3 vColor0;       // the triangle's three vertex colors,
  varying vec3 vColor1;       // unchanged by the rasterizer
  varying vec3 vColor2;

  uniform int uMode;          // which interpolation rule: set from the menu

  // -------------------------------------------------------------------
  // interpolate(): THE INTERPOLATION RULE. This is the part to experiment with.
  //
  //   b          - this fragment's barycentric weights: b.x = λ0, b.y = λ1,
  //                b.z = λ2. Each is between 0 and 1, and they add up
  //                to 1. Near vertex 0, b.x is close to 1.
  //   c0, c1, c2 - the colors of the triangle's three vertices
  //
  // Returns the color for this fragment (before lighting).
  //
  // TO ADD YOUR OWN RULE:
  //   1. Add a new case below, e.g.  if (uMode == 5) { ... return ...; }
  //   2. Add a matching <option value="5"> to the menu in
  //      5-custom-interpolation.html.
  //   3. Reload the page. If the shader has a typo, the error message
  //      shows up in the browser's developer console.
  //
  // (GLSL tip: write decimal numbers with a dot, e.g. 2.0 rather than 2.
  // GLSL does not mix ints and floats automatically.)
  // -------------------------------------------------------------------
  vec3 interpolate(vec3 b, vec3 c0, vec3 c1, vec3 c2) {

    // RULE 0 - LINEAR: the weighted average. This is exactly what the
    // rasterizer did for us in example 4, so the cube should look the
    // same as in tab 4.
    if (uMode == 0) {
      return b.x * c0 + b.y * c1 + b.z * c2;
    }

    // RULE 1 - NEAREST VERTEX: no mixing at all. Use the color of the
    // vertex with the biggest weight (the closest vertex). This is
    // "nearest-neighbor" interpolation. Each triangle
    // splits into 3 flat patches, and the diagonal where a face's two
    // triangles meet becomes easy to see.
    if (uMode == 1) {
      if (b.x >= b.y && b.x >= b.z) return c0;
      if (b.y >= b.z) return c1;
      return c2;
    }

    // RULE 2 - SHARPENED: raise each weight to a power, then rescale so
    // the weights add up to 1 again. Big weights stay big and small ones
    // shrink, so each vertex's color stays "pure" for longer and the
    // mixing gets squeezed toward the middle and the edges.
    // Try other powers: 1.0 gives linear again, bigger = sharper.
    if (uMode == 2) {
      float power = 4.0;
      // max(b, 0.0): at the very edge a weight can come out a hair below
      // 0 from rounding, and pow() is not defined for negative numbers.
      vec3 w = pow(max(b, 0.0), vec3(power));
      w = w / (w.x + w.y + w.z);          // make them add up to 1 again
      return w.x * c0 + w.y * c1 + w.z * c2;
    }

    // RULE 3 - BANDS: round each weight down to one of a few steps
    // (0, 1/4, 2/4, ...), like a contour map. The color changes in
    // stripes instead of smoothly, which shows the lines where a weight
    // is constant. Rounding breaks "add up to 1", so we rescale again.
    // (The largest weight is always at least 1/3, so the sum can't be 0.)
    if (uMode == 3) {
      float steps = 4.0;
      vec3 w = floor(b * steps) / steps;
      w = w / (w.x + w.y + w.z);
      return w.x * c0 + w.y * c1 + w.z * c2;
    }

    // RULE 4 - WIREFRAME: linear interpolation, but draw the triangle's edges.
    // On an edge, the weight of the OPPOSITE vertex is 0. So the smallest
    // of the three weights tells us how close we are to the nearest edge.
    // (The lines get thicker as triangles get bigger on screen, because
    // the weights are measured relative to the triangle, not in pixels.)
    if (uMode == 4) {
      vec3 color = b.x * c0 + b.y * c1 + b.z * c2;
      float distanceToEdge = min(b.x, min(b.y, b.z));
      if (distanceToEdge < 0.02) {
        color = vec3(0.05);               // near an edge: almost black
      }
      return color;
    }

    // Unknown mode: bright pink, so a missing case is easy to spot.
    return vec3(1.0, 0.0, 1.0);
  }

  void main() {
    // This runs once for EVERY FRAGMENT inside each triangle. (A
    // FRAGMENT is a candidate pixel: one triangle's contribution to one
    // pixel. Where triangles overlap, a pixel gets several fragments and
    // the depth test keeps the closest.) Unlike in examples 2-4, the
    // color is not interpolated for us: we get the raw ingredients
    // (weights and three vertex colors) and mix them here.
    vec3 color = interpolate(vBary, vColor0, vColor1, vColor2);

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
    gl_FragColor = vec4(color * light, 1.0);    // 1.0 = fully opaque
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
//    We first write the cube EXACTLY as in example 4, 9 numbers per
//    vertex:
//         x,    y,    z,      nx, ny, nz,      r,   g,   b
//        (position)          (normal)         (color)
//
//    Then a short loop (further down) rebuilds it into the 18-number
//    layout this example's shaders need.
//
//    COLORS IN THIS FILE: one color per CUBE CORNER. Every vertex at a
//    given cube corner uses that corner's color, whichever face it
//    belongs to.
//    We use the classic "RGB color cube": the corner at (x, y, z) gets
//    the color (x + 0.5, y + 0.5, z + 0.5). So x controls red, y controls
//    green and z controls blue: black at (-,-,-), white at (+,+,+), and
//    red, green, blue, yellow, magenta and cyan at the other corners.
//
//    HOW THE RASTERIZER INTERPOLATES THE COLORS: BARYCENTRIC COORDINATES
//    Any point P inside a triangle with vertices V0, V1, V2 can be written
//    as a weighted average of the vertices:
//
//        P = λ0·V0 + λ1·V1 + λ2·V2,   with  λ0 + λ1 + λ2 = 1
//
//    The weights (λ0, λ1, λ2) are P's barycentric coordinates. At V0
//    they are (1, 0, 0); in the middle they are about (⅓, ⅓, ⅓). The
//    closer P is to a vertex, the bigger that vertex's weight.
//
//    For every fragment, the rasterizer finds its weights and uses the SAME
//    weights to interpolate the vertex colors:
//
//        color = λ0·C0 + λ1·C1 + λ2·C2
//
//    In example 4 the rasterizer did this for us. In THIS example we
//    write that formula ourselves, in interpolate() in the fragment shader.
//    The rasterizer still finds the weights: it hands them to us in
//    vBary. (WebGL corrects the weights for perspective, so vBary is
//    perspective-correct too, and rule 0 matches example 4.)
//
//    A WORD OF WARNING: "interpolation" is not "blending". In WebGL,
//    BLENDING means something else: a later stage, turned on with
//    gl.enable(gl.BLEND), that mixes a fragment's color with the color
//    already in that pixel (that's how transparency works). We don't use
//    it here.
//
//    SOMETHING TO LOOK FOR: each face is made of 2 triangles, and each
//    triangle only knows about its own 3 vertices. In example 4 you could
//    just barely see the diagonal where the two triangles meet. The
//    "nearest vertex" and "wireframe" rules make it obvious.
// ---------------------------------------------------------------------

// One color per corner: color = position + 0.5, so x→red, y→green, z→blue.
//                    corner (x,    y,    z)
const BLACK   = [0, 0, 0];   // (-0.5, -0.5, -0.5)
const RED     = [1, 0, 0];   // (+0.5, -0.5, -0.5)
const GREEN   = [0, 1, 0];   // (-0.5, +0.5, -0.5)
const BLUE    = [0, 0, 1];   // (-0.5, -0.5, +0.5)
const YELLOW  = [1, 1, 0];   // (+0.5, +0.5, -0.5)
const MAGENTA = [1, 0, 1];   // (+0.5, -0.5, +0.5)
const CYAN    = [0, 1, 1];   // (-0.5, +0.5, +0.5)
const WHITE   = [1, 1, 1];   // (+0.5, +0.5, +0.5)

const cubeVertices = new Float32Array([
    // Front face (normal points toward +z)
    -0.5, -0.5,  0.5,    0,  0,  1,   ...BLUE,
     0.5, -0.5,  0.5,    0,  0,  1,   ...MAGENTA,
     0.5,  0.5,  0.5,    0,  0,  1,   ...WHITE,
    -0.5, -0.5,  0.5,    0,  0,  1,   ...BLUE,
     0.5,  0.5,  0.5,    0,  0,  1,   ...WHITE,
    -0.5,  0.5,  0.5,    0,  0,  1,   ...CYAN,

    // Back face (-z)
    -0.5, -0.5, -0.5,    0,  0, -1,   ...BLACK,
     0.5,  0.5, -0.5,    0,  0, -1,   ...YELLOW,
     0.5, -0.5, -0.5,    0,  0, -1,   ...RED,
    -0.5, -0.5, -0.5,    0,  0, -1,   ...BLACK,
    -0.5,  0.5, -0.5,    0,  0, -1,   ...GREEN,
     0.5,  0.5, -0.5,    0,  0, -1,   ...YELLOW,

    // Top face (+y)
    -0.5,  0.5, -0.5,    0,  1,  0,   ...GREEN,
    -0.5,  0.5,  0.5,    0,  1,  0,   ...CYAN,
     0.5,  0.5,  0.5,    0,  1,  0,   ...WHITE,
    -0.5,  0.5, -0.5,    0,  1,  0,   ...GREEN,
     0.5,  0.5,  0.5,    0,  1,  0,   ...WHITE,
     0.5,  0.5, -0.5,    0,  1,  0,   ...YELLOW,

    // Bottom face (-y)
    -0.5, -0.5, -0.5,    0, -1,  0,   ...BLACK,
     0.5, -0.5,  0.5,    0, -1,  0,   ...MAGENTA,
    -0.5, -0.5,  0.5,    0, -1,  0,   ...BLUE,
    -0.5, -0.5, -0.5,    0, -1,  0,   ...BLACK,
     0.5, -0.5, -0.5,    0, -1,  0,   ...RED,
     0.5, -0.5,  0.5,    0, -1,  0,   ...MAGENTA,

    // Right face (+x)
     0.5, -0.5, -0.5,    1,  0,  0,   ...RED,
     0.5,  0.5, -0.5,    1,  0,  0,   ...YELLOW,
     0.5,  0.5,  0.5,    1,  0,  0,   ...WHITE,
     0.5, -0.5, -0.5,    1,  0,  0,   ...RED,
     0.5,  0.5,  0.5,    1,  0,  0,   ...WHITE,
     0.5, -0.5,  0.5,    1,  0,  0,   ...MAGENTA,

    // Left face (-x)
    -0.5, -0.5, -0.5,   -1,  0,  0,   ...BLACK,
    -0.5,  0.5,  0.5,   -1,  0,  0,   ...CYAN,
    -0.5,  0.5, -0.5,   -1,  0,  0,   ...GREEN,
    -0.5, -0.5, -0.5,   -1,  0,  0,   ...BLACK,
    -0.5, -0.5,  0.5,   -1,  0,  0,   ...BLUE,
    -0.5,  0.5,  0.5,   -1,  0,  0,   ...CYAN,
]);
const VERTEX_COUNT = 36;

// REBUILD THE DATA: 9 numbers per vertex → 18 numbers per vertex.
//
// Each vertex needs its barycentric coordinates (aBary: which vertex of
// its triangle it is) and all three vertex colors of its triangle
// (aColor0/1/2). That information depends on the TRIANGLE, not just the
// vertex, so we walk through the cube one triangle (3 vertices) at a time.
//
// New layout of each vertex:
//    x, y, z,   nx, ny, nz,   λ0, λ1, λ2,   r0,g0,b0,   r1,g1,b1,   r2,g2,b2
//   (position)  (normal)      (aBary)       (aColor0)   (aColor1)   (aColor2)
//
// This is why we can't SHARE vertices between triangles (with an index
// buffer): a cube corner might be vertex 0 of one triangle and vertex 2
// of the next, so it needs a different aBary in each. Every triangle
// gets its own 3 vertices, just as we've been doing with drawArrays.
const FLOATS_PER_INPUT_VERTEX = 9;    // the layout of cubeVertices above
const FLOATS_PER_VERTEX = 18;         // the layout the shaders read

// The barycentric coordinates of the 1st, 2nd and 3rd vertex of a
// triangle. (At a vertex, that vertex's weight is 1 and the others are 0.)
const BARY_COORDS = [
    [1, 0, 0],   // 1st vertex: 100% vertex 0
    [0, 1, 0],   // 2nd vertex: 100% vertex 1
    [0, 0, 1],   // 3rd vertex: 100% vertex 2
];

// Small helpers to pull pieces out of vertex number v of cubeVertices.
// (slice(start, end) copies the numbers from index start up to, but not
// including, end.)
function positionAndNormalOf(v) {
    const start = v * FLOATS_PER_INPUT_VERTEX;
    return cubeVertices.slice(start, start + 6);      // x,y,z, nx,ny,nz
}
function colorOf(v) {
    const start = v * FLOATS_PER_INPUT_VERTEX;
    return cubeVertices.slice(start + 6, start + 9);  // r,g,b
}

const vertexList = [];
// `first` is the index of the first vertex of each triangle: 0, 3, 6, ...
for (let first = 0; first < VERTEX_COUNT; first += 3) {
    // The triangle's three vertex colors. Every vertex of this triangle
    // will carry all three.
    const color0 = colorOf(first);
    const color1 = colorOf(first + 1);
    const color2 = colorOf(first + 2);

    // Write out the triangle's 3 vertices. (`...` spreads each piece's
    // numbers into the list one by one.)
    for (let i = 0; i < 3; i++) {
        vertexList.push(
            ...positionAndNormalOf(first + i),        // same as before
            ...BARY_COORDS[i],                        // which vertex am I?
            ...color0, ...color1, ...color2,          // all three colors
        );
    }
}
const vertexData = new Float32Array(vertexList);   // 36 × 18 numbers

// Copy the vertex data into GPU memory.
//   createBuffer - reserve a new, empty buffer on the GPU
//   bindBuffer   - make it the "current" buffer; the next buffer
//                  commands act on whichever buffer is bound
//                  (ARRAY_BUFFER means "this holds vertex data")
//   bufferData   - copy our numbers into it. STATIC_DRAW is a hint
//                  that we'll fill it once and draw from it many times.
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

// Tell the GPU how to read the buffer: which numbers are the position,
// which are the normal, which are the barycentric coordinates, and which are
// the three colors.
//   stride = bytes from one vertex to the next = 18 floats × 4 bytes = 72
//   offset = where in each vertex this attribute starts
const BYTES_PER_FLOAT = 4;
const stride = FLOATS_PER_VERTEX * BYTES_PER_FLOAT;

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
//   | x | y | z | nx| ny| nz| λ0| λ1| λ2| r0| g0| b0| r1| g1| b1| r2| g2| b2|
//   0           12          24          36          48          60          72
//   ^aPosition  ^aNormal    ^aBary      ^aColor0    ^aColor1    ^aColor2
//
// Every attribute here is 3 floats, and they sit one after another, so
// attribute number i starts 3·i floats into the vertex. With six
// attributes, a small helper saves us writing the three steps six times.
function connectAttribute(name, offsetInFloats) {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, stride, offsetInFloats * BYTES_PER_FLOAT);
}

connectAttribute('aPosition', 0);    // x, y, z
connectAttribute('aNormal',   3);    // nx, ny, nz
connectAttribute('aBary',     6);    // λ0, λ1, λ2
connectAttribute('aColor0',   9);    // 1st vertex's color
connectAttribute('aColor1',  12);    // 2nd vertex's color
connectAttribute('aColor2',  15);    // 3rd vertex's color
// (WebGL guarantees at least 8 attributes, so 6 is fine.)

// Look up where each uniform lives so we can set it later.
// Unlike attributes, uniforms don't come from the buffer: we send their
// values directly from JavaScript (gl.uniformMatrix4fv) in draw().
// These variables hold a LOCATION (an address in the program), not the
// value itself.
//   uModel      - per frame: the cube's current rotation
//   uView       - per frame: the camera's position and direction
//   uProjection - per frame: perspective (far things look smaller)
//   uMode       - per frame: which interpolation rule the menu is set to
// (There is no uColor any more: color now comes from the buffer.)
const uModel = gl.getUniformLocation(program, 'uModel');
const uView = gl.getUniformLocation(program, 'uView');
const uProjection = gl.getUniformLocation(program, 'uProjection');
const uMode = gl.getUniformLocation(program, 'uMode');

// The <select> menu on the page that picks the interpolation rule. Each
// <option> has a value ("0", "1", ...) matching a case in interpolate().
const modeMenu = document.getElementById('mode');


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

    // Tell the fragment shader which interpolation rule to use. We read the
    // menu every frame, so a new choice shows up right away.
    // uniform1i = "set a uniform that is 1 integer".
    gl.uniform1i(uMode, Number(modeMenu.value));

    // The actual draw call: "read VERTEX_COUNT (36) vertices from the
    // buffer, starting at vertex 0, and treat every 3 as a triangle."
    // For this call the GPU:
    //   1. runs the vertex shader once per vertex (36 times) to find
    //      where each vertex lands on the screen
    //   2. RASTERIZES: finds the fragments each triangle covers, and
    //      interpolates
    //      the varyings (vBary, vNormal, ...) for each of those fragments
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
