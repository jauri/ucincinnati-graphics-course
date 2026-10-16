// =============================================================================
// index.js — A camera orbiting a simple 3D scene, in plain WebGL.
//
// THE BIG IDEA
// ------------
// The scene (a floor and a few boxes) NEVER moves. Every frame we place a
// "camera" at a new spot on a circle around the scene, point it at the center,
// and redraw. Because the camera moves a little each frame, it looks like we
// are flying around the objects.
//
// HOW A 3D POINT REACHES THE SCREEN
// ---------------------------------
// Every vertex goes through a chain of coordinate spaces. Each step is done by
// multiplying by a 4x4 matrix:
//
//   object space --(MODEL)--> world space --(VIEW)--> camera space
//                --(PROJECTION)--> clip space --(GPU)--> pixels on screen
//
//   MODEL      : places one object in the world (move it, size it).
//   VIEW       : moves the whole world so the camera sits at the origin
//                looking down the -Z axis. THIS IS THE CAMERA. To move the
//                camera, we only change this matrix.
//   PROJECTION : adds perspective (far things look smaller).
//
// FILE OUTLINE
//   Step 1. Get a WebGL context from the canvas.
//   Step 2. Write the shaders (small programs that run on the GPU).
//   Step 3. Compile and link the shaders into a "program".
//   Step 4. Describe a cube and upload its data to the GPU.
//   Step 5. Describe the scene: which boxes go where, in what color.
//   Step 6. Hand-written matrix helpers (perspective, lookAt, model).
//   Step 7. The animation loop: move the camera, draw everything, repeat.
// =============================================================================


// -----------------------------------------------------------------------------
// Step 1. Get a WebGL context from the canvas.
// -----------------------------------------------------------------------------
// The canvas is just a rectangle on the page. To draw into it with the GPU, we
// ask it for a "WebGL rendering context". The object we get back (named `gl`
// by convention) holds every WebGL function and constant we will use.
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
  // Very old browsers or disabled graphics drivers may not support WebGL.
  alert('Sorry, your browser does not support WebGL.');
}


// -----------------------------------------------------------------------------
// Step 2. Write the shaders.
// -----------------------------------------------------------------------------
// WebGL does not know how to draw a "box" or a "camera". It only knows how to
// draw triangles, and it asks US to supply two small programs, written in a
// C-like language called GLSL, that run on the graphics card:
//
//   * The VERTEX shader runs once for every corner (vertex) of every triangle.
//     Its job: compute where that corner lands on the screen.
//
//   * The FRAGMENT shader runs once for every pixel a triangle covers.
//     Its job: decide that pixel's color.
//
// Shaders get data in three ways:
//   attribute : a value that is different for each vertex (e.g. its position).
//   uniform   : a value that is the same for every vertex in one draw call
//               (e.g. the camera matrix, or the object's color).
//   varying   : a value the vertex shader hands to the fragment shader. The GPU
//               blends (interpolates) it across the triangle.
//
// The "// language=GLSL" and "/* glsl */" comments below tell your editor to
// color the string as GLSL (needs a GLSL plugin). They don't change what the
// program does.

// language=GLSL
const vertexShaderSource = /* glsl */ `
  // Per-vertex inputs (filled from buffers we upload in Step 4).
  attribute vec3 a_position;  // corner position in the object's own space
  attribute float a_shade;    // brightness of the face this corner belongs to

  // Same-for-the-whole-object inputs (set from JavaScript before each draw).
  uniform mat4 u_model;       // object space -> world space
  uniform mat4 u_view;        // world space  -> camera space  (THE CAMERA)
  uniform mat4 u_projection;  // camera space -> clip space    (perspective)

  // Output passed along to the fragment shader.
  varying float v_shade;

  void main() {
    // vec4(a_position, 1.0) turns the 3D point (x, y, z) into the 4D point
    // (x, y, z, 1). The extra 1 is needed so a 4x4 matrix can TRANSLATE
    // (move) the point, not just rotate/scale it.
    //
    // Read the multiplication from RIGHT to LEFT: first model, then view,
    // then projection. gl_Position is a built-in output: the final position.
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);

    v_shade = a_shade;
  }
`;

// language=GLSL
const fragmentShaderSource = /* glsl */ `
  // Fragment shaders must say how precise their decimal numbers are.
  // "mediump" (medium precision) is plenty for colors.
  precision mediump float;

  uniform vec3 u_color;   // the object's base color (red, green, blue in 0..1)
  varying float v_shade;  // received from the vertex shader

  void main() {
    // Darken the base color by the face's shade so each side of a box looks
    // a little different. Without this, a box would look like a flat
    // silhouette and you could not tell it is 3D. (This is a cheap stand-in
    // for real lighting, which is a topic for another day.)
    //
    // gl_FragColor is a built-in output: (red, green, blue, alpha/opacity).
    gl_FragColor = vec4(u_color * v_shade, 1.0);
  }
`;


// -----------------------------------------------------------------------------
// Step 3. Compile and link the shaders into a "program".
// -----------------------------------------------------------------------------
// The GPU cannot run GLSL text directly. Like C code, it must be compiled.
// Then the vertex and fragment shaders are "linked" together into one program.

// Compile one shader. `type` is gl.VERTEX_SHADER or gl.FRAGMENT_SHADER.
function compileShader(type, source) {
  const shader = gl.createShader(type);   // make an empty shader object
  gl.shaderSource(shader, source);        // give it our GLSL text
  gl.compileShader(shader);               // compile it

  // If there is a typo in the GLSL, this prints the compiler's error message
  // to the browser console (open it with F12 / Cmd+Option+I).
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  console.error(gl.getProgramInfoLog(program));
}

// Tell WebGL "use this program for the drawing that follows".
gl.useProgram(program);

// To send data to a shader variable, we first need its "location" (think of
// it as an address). We look each one up by the exact name used in the GLSL.
const a_position   = gl.getAttribLocation(program, 'a_position');
const a_shade      = gl.getAttribLocation(program, 'a_shade');
const u_model      = gl.getUniformLocation(program, 'u_model');
const u_view       = gl.getUniformLocation(program, 'u_view');
const u_projection = gl.getUniformLocation(program, 'u_projection');
const u_color      = gl.getUniformLocation(program, 'u_color');


// -----------------------------------------------------------------------------
// Step 4. Describe a cube and upload its data to the GPU.
// -----------------------------------------------------------------------------
// Every object in this scene is the SAME cube, just moved and stretched by its
// model matrix. So we only need to describe one cube.
//
// The cube is centered on the origin and is 1 unit wide (from -0.5 to +0.5 on
// every axis). It has 6 square faces. WebGL only draws triangles, so each
// square is split into 2 triangles = 6 vertices per face, 36 vertices total.
//
//        y (up)
//        |
//        |____ x (right)
//       /
//      z (toward you)

const cubePositions = new Float32Array([
  // Front face (z = +0.5)
  -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,   // triangle 1
  -0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,   // triangle 2
  // Back face (z = -0.5)
   0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,
   0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,
  // Top face (y = +0.5)
  -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,
  -0.5,  0.5,  0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5,
  // Bottom face (y = -0.5)
  -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,
  -0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5,
  // Right face (x = +0.5)
   0.5, -0.5,  0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,
   0.5, -0.5,  0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,
  // Left face (x = -0.5)
  -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,
  -0.5, -0.5, -0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5,
]);

// One brightness value per vertex. All 6 vertices of a face share the same
// value, so each face is a flat, slightly different shade.
// (1.0 = full color, smaller = darker.)
const cubeShades = new Float32Array([
  0.85, 0.85, 0.85, 0.85, 0.85, 0.85,   // front
  0.70, 0.70, 0.70, 0.70, 0.70, 0.70,   // back
  1.00, 1.00, 1.00, 1.00, 1.00, 1.00,   // top    (brightest, "lit from above")
  0.40, 0.40, 0.40, 0.40, 0.40, 0.40,   // bottom (darkest)
  0.75, 0.75, 0.75, 0.75, 0.75, 0.75,   // right
  0.60, 0.60, 0.60, 0.60, 0.60, 0.60,   // left
]);

const VERTEX_COUNT = 36;

// A "buffer" is a block of memory on the GPU. We create one, "bind" it (make
// it the current ARRAY_BUFFER that later calls refer to), and copy our
// JavaScript array into it. STATIC_DRAW is a hint: "we upload this once and
// draw it many times".
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubePositions, gl.STATIC_DRAW);

// Now connect the buffer to the shader's a_position attribute.
// vertexAttribPointer reads from whichever buffer is currently bound.
//   arguments: (location, numbers per vertex, number type, normalize?,
//               stride, offset)
//   "3, gl.FLOAT" means: take 3 floats (x, y, z) for each vertex.
//   stride 0 / offset 0 means: the values are tightly packed from the start.
gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(a_position);   // attributes are OFF until enabled

// Same thing for the shade values: 1 float per vertex.
const shadeBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeShades, gl.STATIC_DRAW);
gl.vertexAttribPointer(a_shade, 1, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(a_shade);


// -----------------------------------------------------------------------------
// Step 5. Describe the scene.
// -----------------------------------------------------------------------------
// Each object = where it sits (position), how big it is along x, y, z (scale),
// and its color (red, green, blue, each 0..1).
//
// The scene is centered on the world origin (0, 0, 0). The floor's top surface
// sits at y = 0, so boxes that rest on it have their center at y = height / 2.
const sceneObjects = [
  // A wide, very thin box acts as the floor.
  { position: [ 0.0, -0.05,  0.0], scale: [8.0, 0.1, 8.0], color: [0.55, 0.55, 0.55] },

  // A tall red tower in the middle.
  { position: [ 0.0,  1.0,   0.0], scale: [1.0, 2.0, 1.0], color: [0.90, 0.25, 0.20] },

  // Three smaller boxes around it.
  { position: [ 2.0,  0.5,   1.0], scale: [1.0, 1.0, 1.0], color: [0.20, 0.55, 0.90] },
  { position: [-2.0,  0.35,  1.5], scale: [0.7, 0.7, 0.7], color: [0.25, 0.80, 0.35] },
  { position: [-1.0,  0.25, -2.0], scale: [1.5, 0.5, 0.8], color: [0.95, 0.80, 0.20] },
];


// -----------------------------------------------------------------------------
// Step 6. Hand-written matrix helpers.
// -----------------------------------------------------------------------------
// A 4x4 matrix is stored as a list of 16 numbers. WebGL expects them in
// COLUMN-MAJOR order: the first 4 numbers are the first COLUMN, the next 4
// are the second column, and so on. So the matrix
//
//     | a  e  i  m |
//     | b  f  j  n |        is stored as  [a,b,c,d,  e,f,g,h,  i,j,k,l,  m,n,o,p]
//     | c  g  k  o |
//     | d  h  l  p |
//
// (Real projects usually use a library such as gl-matrix for this. We write
// it ourselves so nothing is hidden.)

// --- Small 3D vector helpers used by lookAt ---
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b)      { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  // The cross product gives a vector perpendicular to both a and b.
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function normalize(v) {
  // Scale a vector so its length is exactly 1 (keep its direction).
  const length = Math.sqrt(dot(v, v));
  return [v[0] / length, v[1] / length, v[2] / length];
}

// MODEL matrix: scale the cube, then move it to `position`.
//
//     | sx  0   0   tx |
//     | 0   sy  0   ty |
//     | 0   0   sz  tz |
//     | 0   0   0   1  |
function makeModelMatrix(position, scale) {
  const [tx, ty, tz] = position;
  const [sx, sy, sz] = scale;
  return new Float32Array([
    sx, 0,  0,  0,    // column 1
    0,  sy, 0,  0,    // column 2
    0,  0,  sz, 0,    // column 3
    tx, ty, tz, 1,    // column 4 (the translation)
  ]);
}

// VIEW matrix
//
// We describe the camera the way a person would:
//   eye    : where the camera is standing
//   target : the point it is looking at
//   up     : which direction is "up" (usually +Y)
//
// From those we build three perpendicular unit vectors — the camera's own
// axes, expressed in world coordinates:
//   zAxis : points BACKWARD, from the target toward the eye. (By convention
//           an OpenGL/WebGL camera looks down its own -Z axis.)
//   xAxis : points to the camera's RIGHT.
//   yAxis : points to the camera's UP.
//
// The view matrix does the OPPOSITE of placing the camera in the world: it
// takes the whole world and moves/rotates it so the camera ends up at the
// origin, looking down -Z. Moving the camera right is exactly the same as
// moving the whole world left — that is the key insight of a view matrix.
function lookAt(eye, target, up) {
  const zAxis = normalize(subtract(eye, target));
  const xAxis = normalize(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);   // already length 1

  // The upper-left 3x3 part ROTATES world directions into camera directions
  // (the camera axes are the ROWS). The last column TRANSLATES so that the
  // eye point lands exactly on the origin.
  return new Float32Array([
    xAxis[0], yAxis[0], zAxis[0], 0,   // column 1
    xAxis[1], yAxis[1], zAxis[1], 0,   // column 2
    xAxis[2], yAxis[2], zAxis[2], 0,   // column 3
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,   // column 4
  ]);
}

// PROJECTION matrix
//
//   fieldOfView : how wide the camera sees, top to bottom, in radians.
//                 Bigger = wide-angle lens, smaller = zoomed-in lens.
//   aspect      : width / height of the canvas, so things are not stretched.
//   near, far   : only things between these distances are drawn.
//
// This matrix squeezes the visible region (a pyramid with its tip cut off,
// called the "view frustum") into a cube from -1 to +1 on each axis. It also
// sets up the 4th coordinate (w) so the GPU can later divide by it — that
// divide is what makes distant objects smaller.
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


// -----------------------------------------------------------------------------
// Step 7. The animation loop.
// -----------------------------------------------------------------------------

// Camera orbit settings. Try changing these!
const ORBIT_RADIUS = 9.0;          // distance from the center of the scene
const ORBIT_HEIGHT = 4.0;          // how high above the floor the camera is
const ORBIT_SPEED  = 0.3;          // radians per second (~21 s per full circle)
const LOOK_AT      = [0, 0.5, 0];  // the point the camera always faces
const UP           = [0, 1, 0];    // "up" is the +Y direction

// Turn on the depth test. Without it, triangles are simply painted in the
// order we draw them, so a far box drawn later would cover a nearer one.
// With it, the GPU keeps a "depth buffer" that remembers how far away each
// pixel's current color is, and only lets nearer pixels win.
gl.enable(gl.DEPTH_TEST);

// Background color (red, green, blue, alpha): a dark blue-gray.
gl.clearColor(0.1, 0.12, 0.16, 1.0);

// The canvas has two sizes: its size on screen (set by CSS) and the number of
// pixels WebGL draws into (canvas.width / canvas.height). We keep them equal
// so the image is sharp, and tell WebGL to use the whole canvas (viewport).
function resizeCanvas() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}

// render() draws ONE frame. requestAnimationFrame asks the browser to call it
// again right before the next screen refresh (usually 60 times per second),
// and passes in the current time in milliseconds.
function render(timeInMilliseconds) {
  resizeCanvas();
  const seconds = timeInMilliseconds / 1000;

  // --- 1. Move the camera --------------------------------------------------
  // The camera travels on a circle around the Y axis. A point on a circle of
  // radius r at angle θ is (r·cos θ, r·sin θ). We make the angle grow with
  // time, so the camera keeps going around. Here the circle lies in the
  // horizontal X-Z plane, raised up to ORBIT_HEIGHT.
  //
  //   Top-down view:          z
  //                           |   * camera at angle θ
  //                           |  /
  //                           | / r
  //                           |/ θ
  //               ------------+------------ x
  //                         scene
  const angle = seconds * ORBIT_SPEED;
  const eye = [
    ORBIT_RADIUS * Math.cos(angle),
    ORBIT_HEIGHT,
    ORBIT_RADIUS * Math.sin(angle),
  ];

  // Point the camera from `eye` at the center of the scene.
  const viewMatrix = lookAt(eye, LOOK_AT, UP);

  // The lens: 45° field of view (converted to radians), matched to the canvas
  // shape. Objects closer than 0.1 or farther than 100 units are not drawn.
  const aspect = canvas.width / canvas.height;
  const projectionMatrix = perspective(45 * Math.PI / 180, aspect, 0.1, 100.0);

  // Send both camera matrices to the shader. They are the same for every
  // object, so we set them once per frame. (The `false` means "do not
  // transpose"; WebGL 1 requires it to be false.)
  gl.uniformMatrix4fv(u_view, false, viewMatrix);
  gl.uniformMatrix4fv(u_projection, false, projectionMatrix);

  // --- 2. Erase the previous frame -----------------------------------------
  // Clear both the colors and the depth buffer, or old frames would linger.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // --- 3. Draw every object ------------------------------------------------
  // The cube data is already on the GPU (Step 4). For each object, we only
  // change its model matrix and color, then draw the same 36 vertices again.
  for (const object of sceneObjects) {
    gl.uniformMatrix4fv(u_model, false, makeModelMatrix(object.position, object.scale));
    gl.uniform3fv(u_color, object.color);

    // Draw triangles, starting at vertex 0, using VERTEX_COUNT vertices.
    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
  }

  // --- 4. Ask for the next frame -------------------------------------------
  requestAnimationFrame(render);
}

// Start the loop.
requestAnimationFrame(render);
