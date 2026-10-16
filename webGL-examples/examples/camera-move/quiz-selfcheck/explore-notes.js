// =====================================================================
//  EXPLORE THE CODE: notes for the exploration page
// =====================================================================
//
// The exploration page shows the whole camera orbit program (index.js,
// with its comments removed) before the quiz starts. Students can:
//   - hover over the code to see which SECTION it belongs to and what
//     that section does
//   - click a line to read a NOTE about that line
//
// The program is split into sections, in the order they appear in
// index.js. Each section has:
//   id       - a short unique name
//   title    - shown in the panel and on the section tag
//   card     - (optional) the quiz card that practices this code
//   summary  - what the section does, in a few sentences
//   links    - (optional) further reading: [link text, url] pairs
//   code     - the code for this section, comments removed. A backtick
//              inside the code must be written as \`
//   notes    - notes for single lines:
//                match - which line(s) the note belongs to:
//                          a string: the first line containing it, searched
//                                    after the previous string match (so
//                                    repeated lines are matched in order)
//                          a RegExp: every line it matches
//                text  - the note
//                links - (optional) [link text, url] pairs
//
// In summary and text, `backticks` show as code.
//
// The code here is a COPY. If index.js changes, update it here too.
// ---------------------------------------------------------------------

// Links to MDN's page for a WebGL function, e.g. mdn('bufferData').
const MDN_GL = 'https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/';
const mdn = (name) => [`MDN: gl.${name}()`, MDN_GL + name];

const MDN = 'https://developer.mozilla.org/en-US/docs/Web/';
const WGF = 'https://webglfundamentals.org/webgl/lessons/';
const LOGL = 'https://learnopengl.com/';

const EXPLORE_SECTIONS = [
  // -------------------------------------------------------------------
  {
    id: 'context',
    title: 'Get the WebGL context',
    summary: "Find the `<canvas>` element in index.html and ask it for a WebGL 1 context. The context, `gl`, is the object every WebGL command goes through. If WebGL is not available, show a message.",
    links: [
      ['WebGL Fundamentals: the basics', WGF + 'webgl-fundamentals.html'],
      ['MDN: getting started with WebGL', MDN + 'API/WebGL_API/Tutorial/Getting_started_with_WebGL'],
    ],
    code: `
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
  alert('Sorry, your browser does not support WebGL.');
}`,
    notes: [
      {
        match: 'getElementById',
        text: "Finds the `<canvas id=\"glcanvas\">` element in index.html. A canvas is a rectangle on the page that a program can draw into. This works because index.html loads the script at the end of `<body>`, after the canvas exists.",
        links: [['MDN: getElementById()', MDN + 'API/Document/getElementById']],
      },
      {
        match: 'getContext',
        text: "Asks the canvas for a WebGL 1 context. Every drawing command is a method on `gl` (like `gl.drawArrays`), and every WebGL constant is a property of it (like `gl.TRIANGLES`). It returns `null` if the browser or graphics driver can't do WebGL.",
        links: [['MDN: canvas.getContext()', MDN + 'API/HTMLCanvasElement/getContext']],
      },
      {
        match: 'if (!gl)',
        text: "`!gl` is true when `getContext` returned `null`. Note that the program only shows a message: it does not stop. The next line that uses `gl` would then throw an error in the console.",
      },
      {
        match: 'alert(',
        text: "Shows a pop-up message to the user. A friendlier page would put the message on the page itself, but an alert is enough for a teaching example.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'vertex-shader',
    title: 'Vertex shader',
    card: 'Vertex shader',
    summary: "A small GLSL program that runs on the GPU once per vertex. It reads each vertex's position and shade from the buffers, moves the position through the model, view, and projection matrices into clip space, and passes the shade on to the fragment shader.",
    links: [
      ['WebGL Fundamentals: shaders and GLSL', WGF + 'webgl-shaders-and-glsl.html'],
      ['LearnOpenGL: coordinate systems', LOGL + 'Getting-started/Coordinate-Systems'],
      ['GLSL ES 1.00 specification (PDF)', 'https://registry.khronos.org/OpenGL/specs/es/2.0/GLSL_ES_Specification_1.00.pdf'],
    ],
    code: `
const vertexShaderSource = \`
  attribute vec3 a_position;
  attribute float a_shade;

  uniform mat4 u_model;
  uniform mat4 u_view;
  uniform mat4 u_projection;

  varying float v_shade;

  void main() {
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);

    v_shade = a_shade;
  }
\`;`,
    notes: [
      {
        match: 'const vertexShaderSource',
        text: "The shader is stored as a JavaScript string. The backtick (a template literal) lets the string span many lines. JavaScript never runs this code: it is handed to the graphics driver, which compiles it (see \"Compiling and linking shaders\").",
      },
      {
        match: 'attribute vec3 a_position',
        text: "`attribute` means a value that is different for every vertex, read from a buffer. `vec3` is 3 floats. This is the vertex's position (x, y, z) in object space: the cube's own coordinates, before it is placed in the world.",
      },
      {
        match: 'attribute float a_shade',
        text: "One number per vertex: how bright the face this vertex belongs to should be (1.0 = full color). It is a stand-in for real lighting.",
      },
      {
        match: 'uniform mat4 u_model',
        text: "`uniform` means one value shared by every vertex in a draw call, set from JavaScript. `mat4` is a 4×4 matrix. The model matrix moves and scales the unit cube into its place in the world. It changes for every object.",
      },
      {
        match: 'uniform mat4 u_view',
        text: "The view matrix: world space → camera space. This is the camera. It is built by `lookAt()` and set once per frame. Moving the camera only ever changes this matrix.",
        links: [['LearnOpenGL: camera', LOGL + 'Getting-started/Camera']],
      },
      {
        match: 'uniform mat4 u_projection',
        text: "The projection matrix: camera space → clip space. It adds perspective, so far things look smaller. It is built by `perspective()` and set once per frame.",
      },
      {
        match: 'varying float v_shade',
        text: "`varying` means an output of the vertex shader that becomes an input of the fragment shader. The GPU interpolates (blends) it across each triangle. Here all three corners of a triangle have the same shade, so the blend gives the same value everywhere on the face.",
      },
      {
        match: 'void main()',
        text: "`main()` runs once for every vertex. One cube has 36 vertices, so it runs 36 times per draw call, and the GPU runs many copies at the same time.",
      },
      {
        match: 'gl_Position',
        text: "`gl_Position` is the built-in output: the vertex's position in clip space. Read the product right to left: model, then view, then projection. `vec4(a_position, 1.0)` adds a fourth number w = 1, so the matrix's translation part moves the point. After this, the GPU divides x, y, and z by w (the perspective divide).",
        links: [['WebGL Fundamentals: 3D perspective', WGF + 'webgl-3d-perspective.html']],
      },
      {
        match: 'v_shade = a_shade',
        text: "Copies this vertex's shade into the varying, so the fragment shader can use it.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'fragment-shader',
    title: 'Fragment shader',
    card: 'Fragment shader',
    summary: "A small GLSL program that runs once for every pixel (fragment) a triangle covers. It multiplies the object's color by the face's shade, so each side of a box looks a little different and the boxes look 3D without real lighting.",
    links: [
      ['WebGL Fundamentals: shaders and GLSL', WGF + 'webgl-shaders-and-glsl.html'],
      ['The Book of Shaders', 'https://thebookofshaders.com/'],
    ],
    code: `
const fragmentShaderSource = \`
  precision mediump float;

  uniform vec3 u_color;
  varying float v_shade;

  void main() {
    gl_FragColor = vec4(u_color * v_shade, 1.0);
  }
\`;`,
    notes: [
      {
        match: 'const fragmentShaderSource',
        text: "The second shader, also stored as a string. A WebGL program always needs one vertex shader and one fragment shader.",
      },
      {
        match: 'precision mediump float',
        text: "Fragment shaders in WebGL 1 must say how precise their floats are; there is no default. `mediump` (medium precision) is plenty for colors. Vertex shaders default to `highp`, so they don't need this line.",
      },
      {
        match: 'uniform vec3 u_color',
        text: "The object's base color as (red, green, blue), each from 0 to 1. It is set from JavaScript with `gl.uniform3fv` before each object is drawn.",
      },
      {
        match: 'varying float v_shade',
        text: "Receives the shade the vertex shader wrote. The name and type must match the vertex shader's `varying` exactly, or the program fails to link.",
      },
      {
        match: 'void main()',
        text: "Runs once for every fragment: each pixel a triangle covers. A box that fills much of the screen runs it many thousands of times.",
      },
      {
        match: 'gl_FragColor',
        text: "The built-in output: this pixel's color as (red, green, blue, alpha). `u_color * v_shade` scales all three color channels by the shade, so a shade of 0.4 gives a color at 40% brightness. Alpha 1.0 means fully opaque.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'compile',
    title: 'Compiling and linking',
    card: 'Compiling and linking shaders',
    summary: "The GPU can't run GLSL text directly. `compileShader` turns each source string into a compiled shader and prints any error. The two shaders are then attached to one program and linked, and `useProgram` makes it the program for all drawing that follows.",
    links: [
      ['WebGL Fundamentals: the basics (shader setup)', WGF + 'webgl-fundamentals.html'],
      ['MDN: adding 2D content (shader setup)', MDN + 'API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context'],
    ],
    code: `
function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

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

gl.useProgram(program);`,
    notes: [
      {
        match: 'function compileShader',
        text: "A helper used twice, once per shader. `type` says which kind of shader to make: `gl.VERTEX_SHADER` or `gl.FRAGMENT_SHADER`.",
      },
      { match: 'gl.createShader', text: "Makes an empty shader object of the given type.", links: [mdn('createShader')] },
      { match: 'gl.shaderSource', text: "Gives the shader its GLSL source text.", links: [mdn('shaderSource')] },
      {
        match: 'gl.compileShader',
        text: "Compiles the GLSL. A typo in the shader does not throw a JavaScript error: compiling just fails quietly, which is why the next line checks.",
        links: [mdn('compileShader')],
      },
      {
        match: 'COMPILE_STATUS',
        text: "Asks whether compiling worked. If not, the info log holds the compiler's error message, with a line number inside the shader.",
        links: [mdn('getShaderParameter'), mdn('getShaderInfoLog')],
      },
      {
        match: 'return shader',
        text: "The shader is returned even if it failed to compile. The program keeps going and the error shows up again when linking. Larger programs usually stop here (for example, by throwing an error).",
      },
      { match: 'const vertexShader', text: "Compiles the vertex shader source from Step 2." },
      { match: 'const fragmentShader', text: "Compiles the fragment shader source from Step 2." },
      {
        match: 'gl.createProgram',
        text: "A program is one vertex shader plus one fragment shader, linked together. It is what the GPU actually runs when drawing.",
        links: [mdn('createProgram')],
      },
      { match: 'attachShader(program, vertexShader)', text: "Adds the vertex shader to the program.", links: [mdn('attachShader')] },
      { match: 'attachShader(program, fragmentShader)', text: "Adds the fragment shader to the program." },
      {
        match: 'gl.linkProgram',
        text: "Links the two shaders. This is where the vertex shader's outputs (`varying`s) are connected to the fragment shader's inputs, and where mismatches are caught.",
        links: [mdn('linkProgram')],
      },
      {
        match: 'LINK_STATUS',
        text: "Checks whether linking worked, and prints the error log if it didn't.",
        links: [mdn('getProgramParameter'), mdn('getProgramInfoLog')],
      },
      {
        match: 'gl.useProgram',
        text: "Makes this program the current one. WebGL remembers it: every draw call and every `gl.uniform...` call after this uses it. This program only has one, so it is set once and never changed.",
        links: [mdn('useProgram')],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'locations',
    title: 'Shader variable locations',
    card: 'Looking up shader variable locations',
    summary: "Before JavaScript can send data to a shader variable, it needs that variable's location. Each one is looked up once, by the exact name used in the GLSL, and saved for later.",
    links: [
      ['WebGL Fundamentals: how it works', WGF + 'webgl-how-it-works.html'],
    ],
    code: `
const a_position   = gl.getAttribLocation(program, 'a_position');
const a_shade      = gl.getAttribLocation(program, 'a_shade');
const u_model      = gl.getUniformLocation(program, 'u_model');
const u_view       = gl.getUniformLocation(program, 'u_view');
const u_projection = gl.getUniformLocation(program, 'u_projection');
const u_color      = gl.getUniformLocation(program, 'u_color');`,
    notes: [
      {
        match: "getAttribLocation(program, 'a_position')",
        text: "Returns a number: the attribute's index. It returns −1 if no attribute has that name (for example, a typo), or if the compiler removed it because the shader never uses it. The JavaScript variables reuse the GLSL names, which makes it easy to see which is which.",
        links: [mdn('getAttribLocation')],
      },
      { match: "'a_shade'", text: "The index of the `a_shade` attribute." },
      {
        match: "getUniformLocation(program, 'u_model')",
        text: "Returns a location object for the uniform, or `null` if there is no active uniform with that name. Setting a uniform with a `null` location does nothing and gives no error, so a typo here fails silently.",
        links: [mdn('getUniformLocation')],
      },
      { match: "'u_view'", text: "The location of the view matrix uniform (the camera)." },
      { match: "'u_projection'", text: "The location of the projection matrix uniform." },
      { match: "'u_color'", text: "The location of the color uniform, used by the fragment shader. Locations belong to the program, not to one shader." },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'positions',
    title: 'Cube positions',
    card: 'Cube vertex data',
    summary: "One unit cube, centered on the origin, written out as triangles. Each square face is 2 triangles = 6 vertices, so the cube has 36 vertices, each with an (x, y, z) position. Every object in the scene reuses this same cube.",
    links: [
      ['MDN: Float32Array', MDN + 'JavaScript/Reference/Global_Objects/Float32Array'],
      ['WebGL Fundamentals: 3D orthographic (building a 3D shape)', WGF + 'webgl-3d-orthographic.html'],
    ],
    code: `
const cubePositions = new Float32Array([
  -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,
  -0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
   0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,
   0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,
  -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,
  -0.5,  0.5,  0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5,
  -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,
  -0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5,
   0.5, -0.5,  0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,
   0.5, -0.5,  0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,
  -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,
  -0.5, -0.5, -0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5,
]);`,
    notes: [
      {
        match: 'const cubePositions',
        text: "A `Float32Array` holds 32-bit floats, the number format the GPU expects (it matches `gl.FLOAT` in `vertexAttribPointer`). A plain JavaScript array can't be uploaded directly.",
        links: [['MDN: Float32Array', MDN + 'JavaScript/Reference/Global_Objects/Float32Array']],
      },
      {
        match: '-0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,',
        text: "Each row is one triangle: three vertices of (x, y, z). These first two rows are the front face, where z = +0.5. Together the two triangles cover the square. Corners shared by two triangles are written twice.",
      },
      {
        match: '0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,',
        text: "Back face: every vertex has z = −0.5. Then come the top (y = +0.5), bottom (y = −0.5), right (x = +0.5), and left (x = −0.5) faces, two rows each.",
      },
      {
        match: /^  -0\.5,  0\.5,  0\.5,   0\.5,  0\.5,  0\.5,   0\.5,  0\.5, -0\.5,$/,
        text: "Top face: every vertex has y = +0.5. The cube runs from −0.5 to +0.5 on every axis, so it is 1 unit wide and centered on the origin.",
      },
      {
        match: ']);',
        text: "12 rows × 3 vertices = 36 vertices = 108 numbers. Each face lists its own copies of its corners, which lets every vertex of a face carry that face's shade in the next array.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'shades',
    title: 'Face shades',
    card: 'Cube vertex data',
    summary: "One brightness value per vertex, in the same order as the positions. All 6 vertices of a face share one value, so each face is a flat, slightly different shade: a cheap stand-in for lighting.",
    code: `
const cubeShades = new Float32Array([
  0.85, 0.85, 0.85, 0.85, 0.85, 0.85,
  0.70, 0.70, 0.70, 0.70, 0.70, 0.70,
  1.00, 1.00, 1.00, 1.00, 1.00, 1.00,
  0.40, 0.40, 0.40, 0.40, 0.40, 0.40,
  0.75, 0.75, 0.75, 0.75, 0.75, 0.75,
  0.60, 0.60, 0.60, 0.60, 0.60, 0.60,
]);

const VERTEX_COUNT = 36;`,
    notes: [
      {
        match: 'const cubeShades',
        text: "A second array, one float per vertex. Vertex number i gets position i from `cubePositions` and shade i from this array, so the two arrays must list the faces in the same order.",
      },
      { match: '0.85, 0.85', text: "Front face: 85% brightness." },
      { match: '0.70, 0.70', text: "Back face: 70%." },
      { match: '1.00, 1.00', text: "Top face: 100%, the brightest, as if light came from above." },
      { match: '0.40, 0.40', text: "Bottom face: 40%, the darkest. With the camera above the floor you rarely see it." },
      { match: '0.75, 0.75', text: "Right face: 75%." },
      { match: '0.60, 0.60', text: "Left face: 60%. Because the shades are fixed per face, they don't change as the camera moves: this is not real lighting." },
      {
        match: 'VERTEX_COUNT',
        text: "6 faces × 2 triangles × 3 vertices = 36. `drawArrays` uses this to know how many vertices to draw.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'buffers',
    title: 'Upload to buffers',
    card: 'Uploading data to buffers',
    summary: "Copy each array into a GPU buffer, then tell each attribute how to read its buffer. `vertexAttribPointer` connects the attribute to whichever buffer is bound at that moment, so the position buffer stays connected to `a_position` even after the shade buffer is bound.",
    links: [
      ['WebGL Fundamentals: how it works (buffers and attributes)', WGF + 'webgl-how-it-works.html'],
      ['MDN: WebGLBuffer', MDN + 'API/WebGLBuffer'],
    ],
    code: `
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubePositions, gl.STATIC_DRAW);

gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(a_position);

const shadeBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeShades, gl.STATIC_DRAW);
gl.vertexAttribPointer(a_shade, 1, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(a_shade);`,
    notes: [
      {
        match: 'const positionBuffer',
        text: "Makes a new, empty buffer: a block of memory managed by WebGL, usually on the GPU.",
        links: [mdn('createBuffer')],
      },
      {
        match: 'bindBuffer(gl.ARRAY_BUFFER, positionBuffer)',
        text: "Makes this buffer the current `ARRAY_BUFFER`. WebGL calls don't take the buffer as an argument; they act on whichever buffer is bound.",
        links: [mdn('bindBuffer')],
      },
      {
        match: 'bufferData(gl.ARRAY_BUFFER, cubePositions',
        text: "Copies the array into the bound buffer. `STATIC_DRAW` is a hint, not a rule: \"we will upload this once and draw it many times\". The driver may use it to decide where to keep the data.",
        links: [mdn('bufferData')],
      },
      {
        match: 'vertexAttribPointer(a_position',
        text: "Tells `a_position` how to read the currently bound buffer: 3 floats per vertex (x, y, z), not normalized, stride 0 (tightly packed), starting at offset 0. It also records which buffer to read, so later `bindBuffer` calls don't change it.",
        links: [mdn('vertexAttribPointer')],
      },
      {
        match: 'enableVertexAttribArray(a_position)',
        text: "Attributes are off by default. Until it is enabled, the shader would see one constant value instead of reading the buffer.",
        links: [mdn('enableVertexAttribArray')],
      },
      { match: 'const shadeBuffer', text: "A second buffer for the shade values." },
      { match: 'bindBuffer(gl.ARRAY_BUFFER, shadeBuffer)', text: "Now the shade buffer is the bound `ARRAY_BUFFER`. `a_position` still reads from the position buffer, because `vertexAttribPointer` already saved that." },
      { match: 'bufferData(gl.ARRAY_BUFFER, cubeShades', text: "Uploads the 36 shade values." },
      { match: 'vertexAttribPointer(a_shade', text: "`a_shade` reads 1 float per vertex from the shade buffer. The size (1) must agree with the shader's `float a_shade`." },
      { match: 'enableVertexAttribArray(a_shade)', text: "Turns on the shade attribute. This setup is done once; the render loop never touches buffers again." },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'scene',
    title: 'The scene',
    card: 'Describing the scene',
    summary: "A plain list of objects. Each one is the same unit cube with its own position (where its center goes), scale (its size along x, y, z), and color. The floor's top is at y = 0, so a box that sits on it has its center at half its height.",
    links: [
      ['MDN: working with objects', MDN + 'JavaScript/Guide/Working_with_objects'],
    ],
    code: `
const sceneObjects = [
  { position: [ 0.0, -0.05,  0.0], scale: [8.0, 0.1, 8.0], color: [0.55, 0.55, 0.55] },

  { position: [ 0.0,  1.0,   0.0], scale: [1.0, 2.0, 1.0], color: [0.90, 0.25, 0.20] },

  { position: [ 2.0,  0.5,   1.0], scale: [1.0, 1.0, 1.0], color: [0.20, 0.55, 0.90] },
  { position: [-2.0,  0.35,  1.5], scale: [0.7, 0.7, 0.7], color: [0.25, 0.80, 0.35] },
  { position: [-1.0,  0.25, -2.0], scale: [1.5, 0.5, 0.8], color: [0.95, 0.80, 0.20] },
];`,
    notes: [
      {
        match: 'const sceneObjects',
        text: "This is plain JavaScript data. Nothing is sent to the GPU here; the render loop reads this list every frame and draws each entry.",
      },
      {
        match: '[ 0.0, -0.05,  0.0]',
        text: "The floor: a cube scaled to 8 × 0.1 × 8, gray. It is 0.1 thick, and its center is 0.05 below zero, so its top surface sits exactly at y = 0.",
      },
      {
        match: '[ 0.0,  1.0,   0.0]',
        text: "The red tower: 2 units tall, so its center is at y = 1 and its bottom touches the floor at y = 0. It sits at the world origin, the center of the orbit.",
      },
      { match: '[ 2.0,  0.5,   1.0]', text: "A blue 1 × 1 × 1 box. Height 1, so center at y = 0.5." },
      { match: '[-2.0,  0.35,  1.5]', text: "A green box scaled 0.7 on every axis (a smaller cube). Height 0.7, so center at y = 0.35." },
      { match: '[-1.0,  0.25, -2.0]', text: "A yellow box with a different scale on each axis: 1.5 wide, 0.5 tall, 0.8 deep. Height 0.5, so center at y = 0.25." },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'vectors',
    title: 'Vector helpers',
    card: 'Vector helpers',
    summary: "Four small functions on 3D vectors stored as `[x, y, z]` arrays: subtract, dot product, cross product, and normalize. `lookAt` uses them to build the camera's axes.",
    links: [
      ['LearnOpenGL: transformations (vectors)', LOGL + 'Getting-started/Transformations'],
      ['Wikipedia: cross product', 'https://en.wikipedia.org/wiki/Cross_product'],
    ],
    code: `
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b)      { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function normalize(v) {
  const length = Math.sqrt(dot(v, v));
  return [v[0] / length, v[1] / length, v[2] / length];
}`,
    notes: [
      {
        match: 'function subtract',
        text: "`a − b`, one component at a time. Subtracting two points gives the vector that points from `b` to `a`.",
      },
      {
        match: 'function dot',
        text: "The dot product: multiply matching components and add. It returns a single number. For two unit vectors it is the cosine of the angle between them, and it is 0 when they are perpendicular. `dot(v, v)` is the length squared.",
        links: [['Wikipedia: dot product', 'https://en.wikipedia.org/wiki/Dot_product']],
      },
      {
        match: 'function cross',
        text: "The cross product returns a new vector perpendicular to both `a` and `b`. Order matters: `cross(b, a)` points the opposite way. Its length is |a|·|b|·sin(angle), so it is zero when `a` and `b` are parallel.",
      },
      { match: 'a[1] * b[2] - a[2] * b[1]', text: "x of the result uses only the y and z components of the inputs." },
      { match: 'a[2] * b[0] - a[0] * b[2]', text: "y of the result uses z and x." },
      { match: 'a[0] * b[1] - a[1] * b[0]', text: "z of the result uses x and y. For example, cross([1,0,0], [0,1,0]) = [0,0,1]: x cross y gives z." },
      {
        match: 'const length',
        text: "The length of `v`, by the Pythagorean theorem: √(x² + y² + z²).",
        links: [['MDN: Math.sqrt()', MDN + 'JavaScript/Reference/Global_Objects/Math/sqrt']],
      },
      {
        match: 'v[0] / length',
        text: "Divides each component by the length, so the result has length 1 and the same direction. If `v` is the zero vector, this divides by 0 and returns `NaN` values; nothing here checks for that.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'model',
    title: 'Model matrix',
    card: 'The model matrix',
    summary: "Builds the 4×4 matrix that scales the unit cube by `scale` and then moves it to `position`. The 16 numbers are listed column by column (column-major), which is the order WebGL expects.",
    links: [
      ['WebGL Fundamentals: 3D orthographic (matrices)', WGF + 'webgl-3d-orthographic.html'],
      ['LearnOpenGL: transformations', LOGL + 'Getting-started/Transformations'],
      ['WebGL Fundamentals: matrices vs. math (column-major)', WGF + 'webgl-matrix-vs-math.html'],
    ],
    code: `
function makeModelMatrix(position, scale) {
  const [tx, ty, tz] = position;
  const [sx, sy, sz] = scale;
  return new Float32Array([
    sx, 0,  0,  0,
    0,  sy, 0,  0,
    0,  0,  sz, 0,
    tx, ty, tz, 1,
  ]);
}`,
    notes: [
      { match: 'function makeModelMatrix', text: "Called once per object per frame, with that object's position and scale from `sceneObjects`." },
      {
        match: 'const [tx, ty, tz]',
        text: "Destructuring: unpacks the 3-element array into three names. `t` is for translation (moving).",
        links: [['MDN: destructuring', MDN + 'JavaScript/Reference/Operators/Destructuring_assignment']],
      },
      { match: 'const [sx, sy, sz]', text: "The scale factors along x, y, and z." },
      { match: 'new Float32Array', text: "16 floats. `gl.uniformMatrix4fv` expects a `Float32Array` (or plain array) of 16 numbers." },
      {
        match: 'sx, 0,  0,  0,',
        text: "Column 1: where the x direction goes. Multiplying by this matrix scales x by `sx`. Written out as rows of code, the matrix looks transposed: each line here is a column of the real matrix.",
      },
      { match: '0,  sy, 0,  0,', text: "Column 2: scales y by `sy`." },
      { match: '0,  0,  sz, 0,', text: "Column 3: scales z by `sz`." },
      {
        match: 'tx, ty, tz, 1,',
        text: "Column 4: the translation. A point with w = 1 gets (tx, ty, tz) added after scaling. Because the scale sits in the 3×3 part and the translation in column 4, this matrix scales first, then moves: the cube is scaled around its own center, then placed.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'lookat',
    title: 'View matrix (lookAt)',
    card: 'The view matrix (lookAt)',
    summary: "Builds the camera. From where the camera is (`eye`), what it looks at (`target`), and which way is up, it computes the camera's right, up, and backward axes. The matrix rotates and moves the whole world so the camera ends up at the origin, looking down −z.",
    links: [
      ['LearnOpenGL: camera (lookAt)', LOGL + 'Getting-started/Camera'],
      ['Song Ho Ahn: OpenGL lookAt', 'https://www.songho.ca/opengl/gl_camera.html'],
      ['WebGL Fundamentals: 3D cameras', WGF + 'webgl-3d-camera.html'],
    ],
    code: `
function lookAt(eye, target, up) {
  const zAxis = normalize(subtract(eye, target));
  const xAxis = normalize(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);

  return new Float32Array([
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
  ]);
}`,
    notes: [
      { match: 'function lookAt', text: "Called once per frame with the camera's new position. Describing a camera by eye, target, and up is how most libraries do it (for example, `mat4.lookAt` in gl-matrix)." },
      {
        match: 'const zAxis',
        text: "`eye − target` points from the target back toward the camera. A WebGL camera looks down its own −z axis, so its +z axis points backward. Normalized to length 1.",
      },
      {
        match: 'const xAxis',
        text: "The camera's right direction: perpendicular to both up and backward. `up` usually isn't perpendicular to `zAxis` (here the camera looks down a little), so the result must be normalized. If `up` were parallel to `zAxis` (camera looking straight down), the cross product would be zero and the matrix would be `NaN`.",
      },
      {
        match: 'const yAxis',
        text: "The camera's true up, perpendicular to the other two. It is already length 1 because `zAxis` and `xAxis` are perpendicular unit vectors. It tilts slightly away from world +y when the camera looks down.",
      },
      {
        match: 'xAxis[0], yAxis[0], zAxis[0], 0,',
        text: "The first three columns hold the camera axes as ROWS of the 3×3 part. Multiplying by it computes dot(xAxis, p), dot(yAxis, p), dot(zAxis, p): the point's coordinates along the camera's axes. That rotates the world into camera space.",
      },
      {
        match: '-dot(xAxis, eye)',
        text: "The translation column. It moves the world so the eye ends up at the origin: put `eye` in for p and you get (0, 0, 0). It is the opposite of placing the camera in the world, which is why it uses minus signs.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'perspective',
    title: 'Perspective projection',
    card: 'Perspective projection',
    summary: "Builds the lens. Things in a cut-off pyramid in front of the camera (the view frustum, set by field of view, aspect, near, and far) end up in a cube from −1 to +1 on each axis after the GPU divides by w. That divide is what makes far things smaller.",
    links: [
      ['WebGL Fundamentals: 3D perspective', WGF + 'webgl-3d-perspective.html'],
      ['Song Ho Ahn: the OpenGL projection matrix (derivation)', 'https://www.songho.ca/opengl/gl_projectionmatrix.html'],
    ],
    code: `
function perspective(fieldOfView, aspect, near, far) {
  const f = 1.0 / Math.tan(fieldOfView / 2);
  const rangeInv = 1.0 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0,                          0,
    0,          f, 0,                          0,
    0,          0, (near + far) * rangeInv,   -1,
    0,          0, 2 * near * far * rangeInv,  0,
  ]);
}`,
    notes: [
      {
        match: 'function perspective',
        text: "`fieldOfView` is the vertical angle in radians, from the bottom of the view to the top. `aspect` is width ÷ height. `near` and `far` are distances in front of the camera; anything closer than `near` or farther than `far` is cut off (clipped).",
      },
      {
        match: 'const f',
        text: "f = 1 / tan(fov / 2). A smaller field of view gives a bigger f, which enlarges everything: zooming in.",
        links: [['MDN: Math.tan()', MDN + 'JavaScript/Reference/Global_Objects/Math/tan']],
      },
      { match: 'const rangeInv', text: "1 / (near − far), used to map depth. It is negative because near < far." },
      {
        match: 'f / aspect',
        text: "x is scaled by f / aspect. Dividing by aspect squeezes x on a wide canvas, so the −1 to +1 range covers more of the scene sideways and squares stay square on screen.",
      },
      { match: '0,          f, 0,', text: "y is scaled by f." },
      {
        match: '(near + far) * rangeInv,   -1',
        text: "The −1 makes w = −z (camera space). Visible points have negative z, so w is their distance in front of the camera. When the GPU divides x and y by w, far points shrink toward the center: perspective.",
      },
      {
        match: '2 * near * far * rangeInv',
        text: "Together with the entry above, maps z so that near → −1 and far → +1 after the divide. The mapping is not linear: most of the depth precision goes to things close to the camera.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'orbit-settings',
    title: 'Orbit settings',
    card: 'Moving the camera',
    summary: "Named constants that describe the camera's path: a circle of radius 9, 4 units above the floor, turning 0.3 radians per second, always looking at a point just above the scene's center. Changing these changes the camera, not the scene.",
    code: `
const ORBIT_RADIUS = 9.0;
const ORBIT_HEIGHT = 4.0;
const ORBIT_SPEED  = 0.3;
const LOOK_AT      = [0, 0.5, 0];
const UP           = [0, 1, 0];`,
    notes: [
      { match: 'ORBIT_RADIUS', text: "How far from the vertical axis through the scene's center the camera travels. Bigger = farther away, so the scene looks smaller." },
      { match: 'ORBIT_HEIGHT', text: "The camera's y value. Since the target is at y = 0.5, a height of 4 makes the camera look down at the scene." },
      { match: 'ORBIT_SPEED', text: "Radians per second. A full circle is 2π ≈ 6.28 radians, so one lap takes 6.28 / 0.3 ≈ 21 seconds. A negative value would orbit the other way." },
      { match: 'LOOK_AT', text: "The target point for `lookAt`. It stays fixed, so the camera always faces the scene while it moves around it." },
      { match: 'const UP', text: "World +y is up. `lookAt` uses it to work out which way the camera's right and up are, so the picture doesn't roll sideways." },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'state',
    title: 'Depth test and canvas size',
    card: 'Depth test, background, and canvas size',
    summary: "One-time drawing settings, plus a helper that keeps the canvas's drawing size equal to its size on the page. The depth test makes nearer surfaces hide farther ones, no matter what order the boxes are drawn in.",
    links: [
      ['WebGL Fundamentals: resizing the canvas', WGF + 'webgl-resizing-the-canvas.html'],
      ['LearnOpenGL: depth testing', LOGL + 'Advanced-OpenGL/Depth-testing'],
    ],
    code: `
gl.enable(gl.DEPTH_TEST);

gl.clearColor(0.1, 0.12, 0.16, 1.0);

function resizeCanvas() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}`,
    notes: [
      {
        match: 'DEPTH_TEST',
        text: "Turns on the depth test. The GPU keeps a depth buffer with one distance per pixel and only draws a fragment if it is nearer than what is already there. Without it, whatever is drawn last covers everything drawn before.",
        links: [mdn('enable')],
      },
      {
        match: 'gl.clearColor',
        text: "Sets the color `gl.clear` will fill with: (red, green, blue, alpha), here a dark blue-gray. It only sets the color; it doesn't clear anything yet. WebGL remembers it, so it is set once.",
        links: [mdn('clearColor')],
      },
      { match: 'function resizeCanvas', text: "Called at the start of every frame, so the picture adjusts when the browser window changes size." },
      {
        match: 'clientWidth',
        text: "The canvas's width on the page, in CSS pixels (set by the CSS `width: 100%`). On a high-DPI screen one CSS pixel is several device pixels, so the image is a bit softer than it could be; multiplying by `window.devicePixelRatio` would fix that.",
        links: [
          ['MDN: clientWidth', MDN + 'API/Element/clientWidth'],
          ['MDN: devicePixelRatio', MDN + 'API/Window/devicePixelRatio'],
        ],
      },
      { match: 'clientHeight', text: "The canvas's height on the page, in CSS pixels." },
      {
        match: 'if (canvas.width',
        text: "`canvas.width` and `canvas.height` are the drawing buffer's size: how many pixels WebGL draws. They are only set when they differ, because setting them clears the canvas and reallocates the buffer.",
      },
      { match: 'canvas.width = width', text: "Makes the drawing buffer as wide as the canvas on screen, so pixels aren't stretched." },
      { match: 'canvas.height = height', text: "Same for the height." },
      {
        match: 'gl.viewport',
        text: "Tells WebGL which rectangle of the canvas to draw into: here, all of it. It maps the −1 to +1 range (after the divide by w) to pixel coordinates. If the canvas changes size and this isn't updated, the picture fills only part of it, or is cut off.",
        links: [mdn('viewport')],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'move-camera',
    title: 'Move the camera',
    card: 'Moving the camera',
    summary: "The start of each frame. The time in seconds sets the angle around the circle; cosine and sine of that angle give the camera's x and z. `lookAt` turns that position into this frame's view matrix.",
    links: [
      ['MDN: Math.cos()', MDN + 'JavaScript/Reference/Global_Objects/Math/cos'],
      ['Wikipedia: unit circle', 'https://en.wikipedia.org/wiki/Unit_circle'],
    ],
    code: `
function render(timeInMilliseconds) {
  resizeCanvas();
  const seconds = timeInMilliseconds / 1000;

  const angle = seconds * ORBIT_SPEED;
  const eye = [
    ORBIT_RADIUS * Math.cos(angle),
    ORBIT_HEIGHT,
    ORBIT_RADIUS * Math.sin(angle),
  ];

  const viewMatrix = lookAt(eye, LOOK_AT, UP);`,
    notes: [
      {
        match: 'function render',
        text: "Draws ONE frame. The browser calls it through `requestAnimationFrame` and passes the time in milliseconds since the page started loading.",
        links: [['MDN: requestAnimationFrame()', MDN + 'API/Window/requestAnimationFrame']],
      },
      { match: 'resizeCanvas()', text: "Match the drawing size to the canvas's current size before drawing." },
      { match: 'const seconds', text: "Milliseconds → seconds, so `ORBIT_SPEED` can be in radians per second." },
      {
        match: 'const angle',
        text: "The angle grows steadily with time. Because it depends on time, not on how many frames have been drawn, the camera moves at the same speed on a 60 Hz and a 120 Hz screen.",
      },
      {
        match: 'Math.cos(angle)',
        text: "A point on a circle of radius r at angle θ is (r·cos θ, r·sin θ). Here the circle lies flat in the x-z plane, so cosine gives x...",
      },
      { match: 'ORBIT_HEIGHT,', text: "...y stays fixed at the orbit height, so the camera moves in a level circle..." },
      { match: 'Math.sin(angle)', text: "...and sine gives z. Since cos² + sin² = 1, the camera is always exactly `ORBIT_RADIUS` from the y axis." },
      {
        match: 'const viewMatrix',
        text: "The only thing that makes the camera move: a new view matrix every frame, pointing from the new `eye` at the same target. The scene data never changes.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'draw-frame',
    title: 'Draw the frame',
    card: 'Drawing one frame',
    summary: "Build the projection from the canvas shape, send both camera matrices once, clear the old frame, then draw the same cube once per object with that object's model matrix and color. Finally, ask the browser to call `render` again before the next screen refresh.",
    links: [
      ['WebGL Fundamentals: drawing multiple things', WGF + 'webgl-drawing-multiple-things.html'],
      ['MDN: requestAnimationFrame()', MDN + 'API/Window/requestAnimationFrame'],
    ],
    code: `
  const aspect = canvas.width / canvas.height;
  const projectionMatrix = perspective(45 * Math.PI / 180, aspect, 0.1, 100.0);

  gl.uniformMatrix4fv(u_view, false, viewMatrix);
  gl.uniformMatrix4fv(u_projection, false, projectionMatrix);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  for (const object of sceneObjects) {
    gl.uniformMatrix4fv(u_model, false, makeModelMatrix(object.position, object.scale));
    gl.uniform3fv(u_color, object.color);

    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
  }

  requestAnimationFrame(render);
}

requestAnimationFrame(render);`,
    notes: [
      { match: 'const aspect', text: "Width ÷ height of the drawing buffer. Computed every frame because the window can be resized." },
      {
        match: 'const projectionMatrix',
        text: "A 45° vertical field of view, converted to radians (× π / 180). Near = 0.1 and far = 100: the whole scene is well inside that range. This only depends on the canvas shape, so it could be built only on resize, but rebuilding it is cheap.",
      },
      {
        match: 'uniformMatrix4fv(u_view',
        text: "Sends the view matrix to the shader. The `false` means \"don't transpose\"; WebGL 1 requires it to be false. The view is the same for every object, so it is sent once per frame, before the loop.",
        links: [mdn('uniformMatrix4fv')],
      },
      { match: 'uniformMatrix4fv(u_projection', text: "Sends the projection matrix, also once per frame." },
      {
        match: 'gl.clear',
        text: "Starts the frame from a blank slate. `|` combines two flags: fill the colors with the clear color, and reset the depth buffer to \"farthest\" so old depths can't hide new surfaces. (By default WebGL also wipes the canvas after each frame is shown, but to transparent black, not the clear color. Clearing explicitly is what gives the blue-gray background, and it means the program doesn't depend on that default.)",
        links: [mdn('clear')],
      },
      {
        match: 'for (const object of sceneObjects)',
        text: "One draw call per object: 5 per frame. The cube data on the GPU is the same each time; only the uniforms change.",
        links: [['MDN: for...of', MDN + 'JavaScript/Reference/Statements/for...of']],
      },
      {
        match: 'uniformMatrix4fv(u_model',
        text: "Builds and sends this object's model matrix. A uniform keeps its value until it is set again, so it must be set before each draw.",
      },
      { match: 'gl.uniform3fv', text: "Sends this object's (r, g, b) color to `u_color`.", links: [mdn('uniform')] },
      {
        match: 'gl.drawArrays',
        text: "Draws `VERTEX_COUNT` (36) vertices starting at vertex 0, taking them three at a time as triangles. The vertex shader runs 36 times; the fragment shader runs for every pixel those 12 triangles cover.",
        links: [mdn('drawArrays')],
      },
      {
        match: '  requestAnimationFrame(render);',
        text: "Asks the browser to call `render` again just before the next screen refresh (often 60 times a second, but it matches the display, and it pauses in background tabs). This one line is what makes it an animation.",
      },
      {
        match: 'requestAnimationFrame(render);',
        text: "Starts the loop. It runs once when the script loads; after that, each frame schedules the next.",
      },
    ],
  },
];
