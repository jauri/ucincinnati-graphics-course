// =====================================================================
//  QUIZ CARDS
// =====================================================================
//
// Each card shows one piece of the WebGL camera orbit program (with its
// comments removed). There are no scores: students check their own
// work. Each card has four steps:
//   1. Summarize   - write a high-level summary of what the code does
//   2. Self-check  - compare their summary with the example and tick off
//                    the key ideas they covered
//   3. Match       - drag the example comments onto the right lines
//   4. Questions   - multiple-choice questions (5 per card)
// Anything missed goes on a review list shown at the end.
//
// Each card has:
//   code        - the uncommented code the student starts from
//   annotated   - the same code with example comments. Its code (with
//                 comments removed) must match `code` exactly. Each line's
//                 comment becomes one piece in the matching step: the
//                 comment at the end of the line, or else the comment on
//                 the line(s) just above it. Comments starting with "..."
//                 are placeholders and are skipped.
//   concepts    - the key ideas for the self-check list:
//                   label    - the idea, as the student sees it
//                   hint     - shown if the student doesn't tick the idea
//                   patterns - regular expressions (lowercase). If one
//                              matches the student's summary, the list
//                              points out the matching words as a hint.
//                              Nothing is ticked automatically.
//   modelAnswer - an example summary
//   questions   - multiple-choice questions:
//                   ask      - the question (`backticks` show as code)
//                   choices  - { text, why, correct: true on exactly one }
//                              `why` is shown when that choice is picked,
//                              so wrong choices should explain the mistake.
//                              Choices are shuffled when shown.
//
// The code here is a COPY of index.js. If index.js changes, update the
// cards by hand.
//
// To add a card, copy an existing one and edit it.
// ---------------------------------------------------------------------

const CARDS = [
  // -------------------------------------------------------------------
  {
    title: 'Vertex shader',
    language: 'glsl',
    code: `
attribute vec3 a_position;
attribute float a_shade;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

varying float v_shade;

void main() {
  gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);

  v_shade = a_shade;
}`,
    annotated: `
attribute vec3 a_position;  // input: this vertex's position (x, y, z) in the cube's own space, read from a buffer
attribute float a_shade;    // input: one brightness number for this vertex, read from a buffer

uniform mat4 u_model;       // model matrix: object space to world space (places and sizes one object)
uniform mat4 u_view;        // view matrix: world space to camera space (this is the camera)
uniform mat4 u_projection;  // projection matrix: camera space to clip space (adds perspective)

varying float v_shade;      // output: the shade, passed on to the fragment shader

void main() {               // runs once for every vertex
  // Apply model, then view, then projection (read right to left); the 1.0 lets the matrices translate the point
  gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);

  v_shade = a_shade;        // copy this vertex's shade into the output for the fragment shader
}`,
    concepts: [
      {
        label: 'It is the vertex shader, which runs on the GPU once per vertex',
        hint: 'This is a vertex shader: a small GPU program that runs once for every vertex (corner) of every triangle.',
        patterns: [/vertex shader|per vertex|each vertex|every vertex|each corner|every corner|each point/],
      },
      {
        label: 'Transforms the position with the model, view, and projection matrices',
        hint: 'The position is multiplied by u_model (place in the world), then u_view (relative to the camera), then u_projection (perspective).',
        patterns: [/model|world/, /view|camera/, /projection|perspective|mvp|transform|matri/],
      },
      {
        label: 'The view matrix is the camera',
        hint: 'u_view is what represents the camera. Moving the camera only changes this one matrix; the vertex data never changes.',
        patterns: [/view matri\w*.{0,20}camera|camera.{0,20}view matri\w*|u_view/],
      },
      {
        label: 'Outputs where the vertex lands on screen (gl_Position)',
        hint: 'gl_Position is the required output: where this vertex ends up (in clip space, which the GPU turns into a screen position).',
        patterns: [/gl_position|screen|clip|lands|ends up|final position|output/],
      },
      {
        label: 'Passes the shade on to the fragment shader (varying)',
        hint: 'v_shade is a varying: it carries the per-vertex shade from the vertex shader to the fragment shader.',
        patterns: [/varying|shade.*(fragment|pass|send|hand)|(pass|send|hand).*shade/],
      },
      {
        label: 'Inputs: attributes (per vertex) and uniforms (shared by the whole draw)',
        hint: 'Attributes (a_position, a_shade) come from buffers and differ per vertex; uniforms (the matrices) are the same for every vertex in a draw call.',
        patterns: [/attribute|uniform|from the buffer|input/],
      },
    ],
    modelAnswer:
      'This is the vertex shader, a GPU program that runs once for each vertex. Its inputs are per-vertex attributes from buffers (position and shade) and three uniform matrices shared by the whole draw call. It moves the vertex position through the model matrix (into the world), the view matrix (relative to the camera; this matrix is the camera), and the projection matrix (perspective), and writes the result to gl_Position, which says where the vertex lands on screen. It also passes the shade to the fragment shader through a varying.',
    questions: [
      {
        ask: 'The camera moves every frame. Which input to this shader changes because of that?',
        choices: [
          { text: '`u_view`', correct: true,
            why: 'The view matrix is the camera. lookAt builds a new one each frame from the camera\'s new position; nothing else needs to change.' },
          { text: '`a_position`',
            why: 'The cube\'s vertex positions are uploaded once and never change. The scene stays still; only the view matrix changes.' },
          { text: '`u_model`',
            why: 'u_model places each object in the world. The objects don\'t move, so their model matrices stay the same from frame to frame.' },
          { text: '`u_projection`',
            why: 'The projection is the lens (field of view, aspect, near, far). It only changes if the canvas changes shape.' },
        ],
      },
      {
        ask: 'In `u_projection * u_view * u_model * vec4(a_position, 1.0)`, which matrix is applied to the position first?',
        choices: [
          { text: '`u_model`', correct: true,
            why: 'Matrix products act right to left: the matrix next to the vector goes first. The cube is placed in the world before anything else.' },
          { text: '`u_projection`',
            why: 'It is written first but applied last. Read the product from right to left.' },
          { text: '`u_view`',
            why: 'The view matrix is applied second, after u_model has placed the object in the world.' },
        ],
      },
      {
        ask: 'Five objects are drawn each frame, each with 36 vertices. How many times does this shader\'s `main()` run per frame?',
        choices: [
          { text: '180: once per vertex, for every draw call', correct: true,
            why: 'Each drawArrays call sends 36 vertices, and there are 5 calls: 5 × 36 = 180 runs.' },
          { text: '5: once per object',
            why: 'Once per object is how often the uniforms change. The shader runs for every vertex of every object.' },
          { text: '36: the cube data is only stored once',
            why: 'The data is stored once, but it is drawn 5 times, and the shader runs again each time.' },
          { text: 'Once per pixel on screen',
            why: 'That is the fragment shader. The vertex shader runs per vertex.' },
        ],
      },
      {
        ask: 'What is the difference between `a_shade` and `u_model`?',
        choices: [
          { text: '`a_shade` can be different for every vertex (it comes from a buffer); `u_model` is the same for every vertex in a draw call', correct: true,
            why: 'Attributes are read from buffers, one value per vertex. Uniforms are set from JavaScript and shared by the whole draw call.' },
          { text: '`a_shade` is set from JavaScript before each draw; `u_model` comes from a buffer',
            why: 'It is the other way around: attributes come from buffers, uniforms are set from JavaScript (gl.uniformMatrix4fv).' },
          { text: 'There is no difference; both are inputs',
            why: 'Both are inputs, but attributes change per vertex and uniforms are fixed for the whole draw call.' },
        ],
      },
      {
        ask: '`a_position` has three numbers (x, y, z), but the shader uses `vec4(a_position, 1.0)`. Why add a fourth number, 1.0?',
        choices: [
          { text: 'The matrices are 4×4, so the vector needs four numbers, and a 1 lets the matrix move (translate) the point', correct: true,
            why: 'A 4×4 matrix multiplies a vector of four numbers. The fourth number, w, decides whether translation applies: with w = 1 the point is moved, with w = 0 it would not be.' },
          { text: 'The 1.0 is the opacity (alpha)',
            why: 'Alpha is the fourth number of a color. For a position, the fourth number is w.' },
          { text: 'It makes the position 1 unit long',
            why: 'Adding 1.0 does not change x, y, or z. It only adds a fourth number, w.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Fragment shader',
    language: 'glsl',
    code: `
precision mediump float;

uniform vec3 u_color;
varying float v_shade;

void main() {
  gl_FragColor = vec4(u_color * v_shade, 1.0);
}`,
    annotated: `
precision mediump float;    // floats in this shader use medium precision (required in a WebGL 1 fragment shader)

uniform vec3 u_color;       // the object's base color as (r, g, b), each from 0 to 1, set from JavaScript
varying float v_shade;      // the face's brightness, received from the vertex shader

void main() {               // runs once per fragment: each pixel a triangle covers
  // Output color: the base color scaled by the shade, with alpha 1 (opaque)
  gl_FragColor = vec4(u_color * v_shade, 1.0);
}`,
    concepts: [
      {
        label: 'It is the fragment shader, which runs once per pixel',
        hint: 'This is a fragment shader: it runs once for every pixel (fragment) covered by a triangle.',
        patterns: [/fragment shader|per pixel|each pixel|every pixel|per fragment|each fragment|every fragment/],
      },
      {
        label: "Uses the object's color, set from JavaScript",
        hint: 'u_color is a uniform: the same color for the whole object, changed before each object is drawn.',
        patterns: [/u_color|colou?r (of|for) (the|each) (object|box)|object'?s colou?r|base colou?r|uniform/],
      },
      {
        label: 'Darkens the color by the face\'s shade, so faces look different',
        hint: 'Multiplying by v_shade makes each face a slightly different brightness, so the boxes look 3D instead of flat.',
        patterns: [/shade|dark|bright|dim|multipl|scale/],
      },
      {
        label: 'This is a stand-in for real lighting',
        hint: 'The shades are fixed numbers per face, not computed from a light. They fake lighting cheaply so the example can focus on the camera.',
        patterns: [/light|fake|stand.?in|3d|depth|flat|silhouette/],
      },
      {
        label: "Outputs the pixel's final color via gl_FragColor",
        hint: 'gl_FragColor is the output: (red, green, blue, alpha) for this pixel. Alpha 1 means opaque.',
        patterns: [/gl_fragcolor|final colou?r|output|colou?r of (the|each|this) pixel|sets? the colou?r/],
      },
    ],
    modelAnswer:
      "This is the fragment shader, which runs once for every pixel a triangle covers. It takes the object's base color (a uniform set from JavaScript before each object is drawn) and multiplies it by the face's shade, which came from the vertex shader. That makes each side of a box a slightly different brightness, a cheap stand-in for lighting so the boxes look 3D. It writes the result, fully opaque, to gl_FragColor.",
    questions: [
      {
        ask: 'If every value in `cubeShades` were 1.0, what would the boxes look like?',
        choices: [
          { text: 'Each box would be one flat color, so its edges and sides would be hard to see', correct: true,
            why: 'With every shade 1.0, every face gets exactly u_color. Each box becomes a flat silhouette and it is hard to tell it is 3D.' },
          { text: 'The boxes would be white',
            why: 'The shade multiplies u_color. A shade of 1.0 leaves the color unchanged; it does not make it white.' },
          { text: 'The boxes would disappear',
            why: 'They are still drawn in their colors. Only the difference between the faces is lost.' },
        ],
      },
      {
        ask: 'The camera orbits around the boxes. Does the top of a box get brighter or darker as the camera moves?',
        choices: [
          { text: 'No: each face\'s brightness is a fixed number that does not depend on the camera', correct: true,
            why: 'v_shade comes straight from the cubeShades array. Nothing in the shader uses the camera or a light, so each face always has the same shade.' },
          { text: 'Yes: faces get brighter as they turn toward the camera',
            why: 'That would need real lighting using the camera or light direction. This shader only multiplies by a fixed per-face number.' },
          { text: 'Yes: faces get darker as the camera moves farther away',
            why: 'Distance makes things smaller (perspective), but nothing here changes their brightness.' },
        ],
      },
      {
        ask: 'What does `u_color * v_shade` compute when `u_color` is (0.9, 0.25, 0.2) and `v_shade` is 0.5?',
        choices: [
          { text: '(0.45, 0.125, 0.1): each channel is multiplied by 0.5', correct: true,
            why: 'Multiplying a vec3 by a float scales every component. The color keeps its hue but is half as bright.' },
          { text: '(1.4, 0.75, 0.7): the shade is added to each channel',
            why: '`*` multiplies; it does not add. Adding would make the color lighter, not darker.' },
          { text: '0.675: a single brightness number',
            why: 'A vec3 times a float gives a vec3, not a single number.' },
        ],
      },
      {
        ask: 'How often does this shader\'s `main()` run?',
        choices: [
          { text: 'Once for every pixel each triangle covers', correct: true,
            why: 'The fragment shader runs per fragment. A box that fills more of the screen runs it more times.' },
          { text: 'Once per vertex',
            why: 'That is the vertex shader.' },
          { text: 'Once per object',
            why: 'Once per object is how often u_color changes. The shader itself runs for every covered pixel.' },
        ],
      },
      {
        ask: 'What does the `1.0` in `vec4(u_color * v_shade, 1.0)` mean?',
        choices: [
          { text: 'Alpha: the pixel is fully opaque', correct: true,
            why: 'gl_FragColor is (red, green, blue, alpha). Alpha 1.0 means not see-through.' },
          { text: 'w, so the color can be translated',
            why: 'w matters for positions multiplied by matrices. For a color, the fourth number is alpha.' },
          { text: 'Full brightness',
            why: 'Brightness here comes from multiplying by v_shade. The fourth number is alpha.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Compiling and linking shaders',
    language: 'javascript',
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
    annotated: `
function compileShader(type, source) {
  const shader = gl.createShader(type);   // make an empty shader object of this type (vertex or fragment)
  gl.shaderSource(shader, source);        // give it the GLSL source text
  gl.compileShader(shader);               // compile the GLSL for the GPU

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {   // did compiling fail?
    console.error(gl.getShaderInfoLog(shader));             // print the compiler's error message to the console
  }
  return shader;
}

const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

const program = gl.createProgram();       // a program holds one vertex shader and one fragment shader
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);                  // link the two shaders, connecting the vertex shader's outputs to the fragment shader's inputs
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {   // did linking fail?
  console.error(gl.getProgramInfoLog(program));
}

gl.useProgram(program);                   // use this program for all drawing that follows`,
    concepts: [
      {
        label: 'Compiles each shader from its GLSL source',
        hint: 'The GPU cannot run GLSL text; each shader is created, given its source, and compiled.',
        patterns: [/compil/],
      },
      {
        label: 'Links the vertex and fragment shaders into one program',
        hint: 'A program pairs one vertex shader with one fragment shader. Linking connects the varyings between them.',
        patterns: [/link|program|combin|attach|together/],
      },
      {
        label: 'Checks for errors and prints them',
        hint: 'A shader typo does not throw a JavaScript error. COMPILE_STATUS and LINK_STATUS are checked, and the error log is printed to the console.',
        patterns: [/error|fail|check|status|log|debug|console/],
      },
      {
        label: 'Makes the program the one used for drawing',
        hint: 'gl.useProgram tells WebGL to run this program for the draw calls that follow.',
        patterns: [/useprogram|use (the|this) program|activ|current|select/],
      },
      {
        label: 'Uses a helper function so the same steps work for both shaders',
        hint: 'compileShader does the create/source/compile/check steps once, and is called for the vertex and the fragment shader.',
        patterns: [/function|helper|both|twice|reus/],
      },
    ],
    modelAnswer:
      'This turns the two GLSL shader strings into something the GPU can run. The compileShader helper creates a shader of the given type, gives it its source, compiles it, and prints the compiler\'s error message if compiling failed; it is called once for the vertex shader and once for the fragment shader. The two compiled shaders are attached to a program and linked, which connects them, and link errors are printed too. Finally useProgram makes this program the one used for all drawing.',
    questions: [
      {
        ask: 'You make a typo in the fragment shader\'s GLSL. What happens?',
        choices: [
          { text: 'An error message from the shader compiler is printed in the browser console, and nothing is drawn correctly', correct: true,
            why: 'Compiling fails quietly; the COMPILE_STATUS check prints the info log (and linking then fails too). Opening the console is the way to find shader errors.' },
          { text: 'JavaScript throws an error at the typo, pointing to the line in index.js',
            why: 'JavaScript only sees a string. The GLSL is compiled by the graphics driver, which reports errors through the info log, not as JavaScript exceptions.' },
          { text: 'The browser fixes small typos automatically',
            why: 'GLSL compilers are strict. Any error makes compiling fail.' },
        ],
      },
      {
        ask: 'Why is linking a separate step from compiling?',
        choices: [
          { text: 'Each shader is compiled alone; linking connects the two, matching the vertex shader\'s outputs (varyings) with the fragment shader\'s inputs', correct: true,
            why: 'A mismatch between the shaders, such as a varying with a different type, can only be found when both are put together.' },
          { text: 'Linking uploads the vertex data to the GPU',
            why: 'Vertex data goes to the GPU with bufferData. Linking only deals with the shaders.' },
          { text: 'Linking runs the shaders once to test them',
            why: 'Nothing runs until drawArrays. Linking prepares the program.' },
        ],
      },
      {
        ask: 'What would happen if `gl.useProgram(program)` were left out?',
        choices: [
          { text: 'Setting uniforms and drawing would fail, because no program is in use', correct: true,
            why: 'gl.uniform... calls and drawArrays act on the current program. With none in use, WebGL reports errors and draws nothing.' },
          { text: 'WebGL would use the last program that was linked',
            why: 'Linking does not make a program current. Only useProgram does.' },
          { text: 'It would still work; useProgram is only needed when there are two programs',
            why: 'Even with one program, it must be made current before drawing.' },
        ],
      },
      {
        ask: 'How often does this code run?',
        choices: [
          { text: 'Once, when the page loads', correct: true,
            why: 'Compiling and linking happen once. The render loop reuses the same program every frame.' },
          { text: 'Once per frame',
            why: 'That would waste a lot of time. The program does not change, so it is built once.' },
          { text: 'Once per object drawn',
            why: 'All objects use the same program. Only the uniforms change per object.' },
        ],
      },
      {
        ask: '`compileShader` returns `shader` even when compiling failed. What is the effect in this program?',
        choices: [
          { text: 'The program keeps going; linking then fails and the console shows the errors', correct: true,
            why: 'Nothing stops the program, so the errors are printed and nothing is drawn correctly. Larger programs often throw an error here instead, to stop right away.' },
          { text: 'The program stops at that line',
            why: 'console.error only prints a message. It does not stop the program.' },
          { text: 'WebGL automatically uses a default shader instead',
            why: 'There is no default shader in WebGL. A failed shader just makes linking fail.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Looking up shader variable locations',
    language: 'javascript',
    code: `
const a_position   = gl.getAttribLocation(program, 'a_position');
const a_shade      = gl.getAttribLocation(program, 'a_shade');
const u_model      = gl.getUniformLocation(program, 'u_model');
const u_view       = gl.getUniformLocation(program, 'u_view');
const u_projection = gl.getUniformLocation(program, 'u_projection');
const u_color      = gl.getUniformLocation(program, 'u_color');`,
    annotated: `
const a_position   = gl.getAttribLocation(program, 'a_position');      // index of the per-vertex position input
const a_shade      = gl.getAttribLocation(program, 'a_shade');         // index of the per-vertex brightness input
const u_model      = gl.getUniformLocation(program, 'u_model');        // where to send each object's placement matrix
const u_view       = gl.getUniformLocation(program, 'u_view');         // where to send the camera matrix
const u_projection = gl.getUniformLocation(program, 'u_projection');   // where to send the perspective matrix
const u_color      = gl.getUniformLocation(program, 'u_color');        // where to send each object's color (used by the fragment shader)`,
    concepts: [
      {
        label: 'Looks up where each shader variable is, so JavaScript can send it data',
        hint: 'To set an attribute or uniform from JavaScript you need its location, a kind of address in the linked program.',
        patterns: [/location|address|where|index|find|look ?up|get/],
      },
      {
        label: 'Looks them up by the exact name used in the GLSL',
        hint: "The string must match the shader's variable name exactly. A typo silently gives -1 or null.",
        patterns: [/name|string|match|same|spell/],
      },
      {
        label: 'Attributes and uniforms are looked up with different functions',
        hint: 'getAttribLocation (returns a number) is for per-vertex inputs; getUniformLocation (returns a location object) is for uniforms.',
        patterns: [/attrib|uniform/],
      },
      {
        label: 'Done once, after linking, and saved for later',
        hint: 'Locations only exist after the program is linked. They are stored in variables and reused every frame.',
        patterns: [/once|save|store|later|reuse|after link/],
      },
    ],
    modelAnswer:
      'This finds the location (a kind of address) of each shader variable in the linked program, so JavaScript can send data to it later. Each one is looked up once by the exact name used in the GLSL and saved in a JavaScript variable with the same name. The two attributes (position and shade) are looked up with getAttribLocation, and the four uniforms (the model, view, and projection matrices and the color) with getUniformLocation.',
    questions: [
      {
        ask: 'You misspell a name: `gl.getUniformLocation(program, \'u_veiw\')`. What happens?',
        choices: [
          { text: 'It returns `null`; setting the camera then does nothing and gives no error, so the camera never works', correct: true,
            why: 'gl.uniformMatrix4fv with a null location is silently ignored. u_view in the shader keeps its default (all zeros), so the scene does not appear.' },
          { text: 'JavaScript throws an error on that line',
            why: 'Looking up a name that doesn\'t exist is not an error. It just returns null.' },
          { text: 'WebGL finds the closest matching name',
            why: 'Names must match exactly; there is no fuzzy matching.' },
        ],
      },
      {
        ask: 'Why are these looked up only once, instead of every frame?',
        choices: [
          { text: 'A location does not change after the program is linked, and looking it up by name is slower than reusing it', correct: true,
            why: 'Saving the locations once and reusing them is the usual pattern.' },
          { text: 'WebGL only allows each location to be looked up once',
            why: 'You can look them up as often as you like; it is just unnecessary work.' },
          { text: 'They are only needed once, when the program is linked',
            why: 'They are used every frame, every time a uniform is set.' },
        ],
      },
      {
        ask: 'Why must this code come after `gl.linkProgram(program)`?',
        choices: [
          { text: 'Locations are decided when the program is linked', correct: true,
            why: 'Before linking, the program has no list of active attributes and uniforms to look up.' },
          { text: 'It doesn\'t matter; locations are fixed by the GLSL text',
            why: 'Locations are assigned by the linker, so they depend on the linked program.' },
          { text: 'getAttribLocation compiles the shader',
            why: 'Compiling is done by gl.compileShader. These calls only look things up.' },
        ],
      },
      {
        ask: 'If the vertex shader declared `a_shade` but never used it, what might `gl.getAttribLocation(program, \'a_shade\')` return?',
        choices: [
          { text: '−1, because the compiler can remove unused variables', correct: true,
            why: 'Variables that do not affect the output may be optimized away, and then they have no location. This often surprises people while they are still writing a shader.' },
          { text: '0, the first location',
            why: 'An unused attribute has no location at all, which getAttribLocation reports as −1.' },
          { text: 'It always returns a valid location, since the name exists in the source',
            why: 'Only active (used) attributes get a location.' },
        ],
      },
      {
        ask: 'Is `u_color` a fragment shader variable or a vertex shader variable, and does that change how it is looked up?',
        choices: [
          { text: 'Fragment shader; it is still looked up on the program with getUniformLocation', correct: true,
            why: 'Uniforms belong to the linked program as a whole, whichever shader uses them.' },
          { text: 'Fragment shader; it must be looked up on fragmentShader instead of program',
            why: 'Locations are looked up on the program, never on a single shader.' },
          { text: 'Vertex shader, like the others',
            why: 'u_color is declared and used in the fragment shader. It is looked up the same way anyway.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Cube vertex data',
    language: 'javascript',
    code: `
const cubePositions = new Float32Array([
  -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,
  -0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
  // ... 5 more faces, 2 rows each
]);

const cubeShades = new Float32Array([
  0.85, 0.85, 0.85, 0.85, 0.85, 0.85,
  0.70, 0.70, 0.70, 0.70, 0.70, 0.70,
  1.00, 1.00, 1.00, 1.00, 1.00, 1.00,
  // ... 3 more faces
]);

const VERTEX_COUNT = 36;`,
    annotated: `
const cubePositions = new Float32Array([   // positions as 32-bit floats, the format the GPU expects
  // Front face (z = +0.5), first triangle: three vertices of (x, y, z)
  -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,
  // Front face, second triangle: together the two triangles make the square; shared corners are repeated
  -0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
  // ... 5 more faces, 2 rows each
]);

const cubeShades = new Float32Array([      // one brightness value per vertex, in the same order as the positions
  0.85, 0.85, 0.85, 0.85, 0.85, 0.85,      // front face: all 6 of its vertices share one shade
  0.70, 0.70, 0.70, 0.70, 0.70, 0.70,      // back face: a bit darker
  1.00, 1.00, 1.00, 1.00, 1.00, 1.00,      // top face: full brightness, as if lit from above
  // ... 3 more faces
]);

const VERTEX_COUNT = 36;                   // total vertices: 6 faces × 2 triangles × 3 vertices`,
    concepts: [
      {
        label: 'Describes one unit cube, reused for every object',
        hint: 'This is the geometry of a single 1×1×1 cube centered on the origin. Every box, and the floor, is this same cube with a different model matrix.',
        patterns: [/cube|geometry|shape|mesh/],
      },
      {
        label: 'The cube is built from triangles: 2 per face, 36 vertices',
        hint: 'WebGL only draws points, lines, and triangles, so each square face is 2 triangles = 6 vertices, and 6 faces × 6 = 36.',
        patterns: [/triangle|36/],
      },
      {
        label: 'Each vertex has a position (x, y, z)',
        hint: 'Every 3 numbers in cubePositions is one vertex position.',
        patterns: [/position|x,? ?y,? ?(and )?z|xyz|coordinate|corner|location/],
      },
      {
        label: 'Each vertex also has a shade; a face\'s 6 vertices share one shade',
        hint: 'cubeShades has one brightness per vertex. All vertices of a face have the same value, so each face is evenly shaded.',
        patterns: [/shade|bright|dark/],
      },
      {
        label: 'Uses Float32Array so it can be sent to the GPU',
        hint: 'Float32Array holds 32-bit floats, which is what bufferData uploads and what gl.FLOAT in vertexAttribPointer means.',
        patterns: [/float32|float|typed|gpu|upload|buffer/],
      },
    ],
    modelAnswer:
      'This describes the one cube that every object in the scene reuses. The cube is 1 unit wide and centered on the origin. Because WebGL draws triangles, each square face is two triangles, so the cube has 6 × 2 × 3 = 36 vertices, each with an (x, y, z) position. A second array gives every vertex a shade (brightness); all six vertices of a face share the same shade so each side looks a little different. Both arrays are Float32Arrays so they can be uploaded to the GPU.',
    questions: [
      {
        ask: 'A cube has only 8 corners. Why does `cubePositions` list 36 vertices?',
        choices: [
          { text: 'WebGL draws triangles, and with drawArrays each triangle lists its own 3 vertices: 12 triangles × 3 = 36', correct: true,
            why: 'Shared corners are written again for each triangle that uses them. That also lets each face give its vertices its own shade.' },
          { text: 'Each corner is listed 4 or 5 times by mistake',
            why: 'The repeats are needed. drawArrays reads vertices in order, 3 per triangle, with no way to reuse one.' },
          { text: 'The extra vertices make the cube smoother',
            why: 'The cube has flat faces. The extra vertices come from listing each triangle\'s corners separately.' },
        ],
      },
      {
        ask: 'Why does a corner shared by the front face and the top face need two separate vertices here?',
        choices: [
          { text: 'It has a different shade on each face (0.85 on the front, 1.00 on top), and a vertex can only have one shade', correct: true,
            why: 'Each vertex carries one value per attribute. To give the same point two different shades, it must appear as two vertices.' },
          { text: 'The GPU cannot use the same position twice',
            why: 'Positions can repeat freely. The repeats here are needed because the shades differ.' },
          { text: 'It doesn\'t; one vertex could be shared by both faces',
            why: 'Sharing it would force both faces to have the same shade at that corner.' },
        ],
      },
      {
        ask: 'If `cubeShades` listed the faces in a different order than `cubePositions` (for example top first), what would happen?',
        choices: [
          { text: 'Faces would get the wrong shades, for example the front face would be the brightest', correct: true,
            why: 'Vertex i gets position i and shade i. The two arrays are only linked by their order.' },
          { text: 'Nothing; WebGL matches each shade to the right face',
            why: 'WebGL knows nothing about faces. It just pairs the arrays by index.' },
          { text: 'WebGL would report an error',
            why: 'Both arrays still have 36 entries, so nothing looks wrong to WebGL.' },
        ],
      },
      {
        ask: 'The floor is 8 units wide, but the cube is only 1 unit wide. Where does the floor\'s size come from?',
        choices: [
          { text: 'Its model matrix scales the cube by 8 along x and z', correct: true,
            why: 'Every object reuses this one unit cube; makeModelMatrix stretches it to each object\'s size.' },
          { text: 'There is a separate, bigger cube for the floor',
            why: 'There is only one set of vertex data. Every object is the same cube.' },
          { text: 'The projection matrix makes it bigger',
            why: 'The projection is the same for every object. Size differences come from each object\'s model matrix.' },
        ],
      },
      {
        ask: 'Why is the cube centered on the origin (from −0.5 to +0.5), instead of from 0 to 1?',
        choices: [
          { text: 'So scaling it grows it evenly around its center, and the object\'s `position` is where its center goes', correct: true,
            why: 'Scaling multiplies coordinates, so it grows things away from the origin. With the origin at the cube\'s center, the cube stays centered on `position`.' },
          { text: 'WebGL can only draw shapes centered on the origin',
            why: 'Any coordinates work. Centering just makes scaling and placing simpler.' },
          { text: 'So the camera can see it',
            why: 'Where the object ends up depends on its model matrix and the camera, not on how the original cube is centered.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Uploading data to buffers',
    language: 'javascript',
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
    annotated: `
const positionBuffer = gl.createBuffer();                        // make an empty buffer: memory managed by WebGL, usually on the GPU
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);                  // make it the current ARRAY_BUFFER, which the next calls act on
gl.bufferData(gl.ARRAY_BUFFER, cubePositions, gl.STATIC_DRAW);   // copy the positions into it (hint: upload once, draw many times)

gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, 0, 0);    // a_position reads 3 floats per vertex from the bound buffer, tightly packed
gl.enableVertexAttribArray(a_position);                          // turn the attribute on (attributes are off by default)

const shadeBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeShades, gl.STATIC_DRAW);      // copy the 36 shade values into the second buffer
gl.vertexAttribPointer(a_shade, 1, gl.FLOAT, false, 0, 0);       // a_shade reads 1 float per vertex from the shade buffer
gl.enableVertexAttribArray(a_shade);`,
    concepts: [
      {
        label: 'Creates buffers on the GPU and copies the arrays into them',
        hint: 'createBuffer makes GPU memory, and bufferData copies the JavaScript array into it.',
        patterns: [/buffer|upload|copy|send|gpu|memory/],
      },
      {
        label: 'Binding: calls act on whichever buffer is currently bound',
        hint: 'bindBuffer makes a buffer the current ARRAY_BUFFER; bufferData and vertexAttribPointer don\'t take a buffer argument, they use the bound one.',
        patterns: [/bind|bound|current|active|select/],
      },
      {
        label: 'Tells each attribute how to read its buffer (vertexAttribPointer)',
        hint: 'vertexAttribPointer says how many floats per vertex (3 for position, 1 for shade), their type, and the layout, and connects the attribute to the bound buffer.',
        patterns: [/attrib|pointer|layout|how to read|per vertex|3 float|connect|link|hook/],
      },
      {
        label: 'Enables each attribute',
        hint: 'enableVertexAttribArray turns the attribute on; without it the shader does not read the buffer.',
        patterns: [/enabl|turn.*on|switch.*on|activat/],
      },
      {
        label: 'Done once at startup; the data never changes',
        hint: 'The scene never changes shape, so the cube is uploaded once (STATIC_DRAW) and drawn every frame.',
        patterns: [/once|static|never change|startup|reuse|every frame/],
      },
    ],
    modelAnswer:
      'This uploads the cube data to the GPU and connects it to the vertex shader. For the positions, it creates a buffer, binds it as the current ARRAY_BUFFER, and copies the position array into it. Then vertexAttribPointer tells a_position to read 3 floats per vertex from that buffer, and the attribute is enabled. The same steps are repeated for the shades, with 1 float per vertex. This is done once at startup; every frame reuses the same data.',
    questions: [
      {
        ask: 'After the shade buffer is bound, `a_position` still reads from the position buffer. Why?',
        choices: [
          { text: '`vertexAttribPointer` recorded which buffer was bound when it was called, and that link stays', correct: true,
            why: 'Each attribute remembers its own buffer. Binding a different buffer afterward only affects later calls.' },
          { text: 'Each attribute automatically uses the buffer created just before it',
            why: 'WebGL does not track creation order. The link is made by vertexAttribPointer, using whatever is bound at that moment.' },
          { text: 'It doesn\'t; both attributes now read from the shade buffer',
            why: 'The program draws correctly, so the link must be kept. vertexAttribPointer saved it.' },
        ],
      },
      {
        ask: 'What would go wrong if `vertexAttribPointer(a_position, ...)` were called after `gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuffer)`?',
        choices: [
          { text: '`a_position` would be connected to the shade buffer, so the positions would never reach the shader', correct: true,
            why: 'vertexAttribPointer uses whichever buffer is bound when it is called. The shade buffer holds only 36 numbers, enough for 12 positions, so WebGL rejects the draw call (an error in the console) and nothing is drawn.' },
          { text: 'Nothing; `vertexAttribPointer` finds the right buffer by the attribute\'s name',
            why: 'WebGL has no idea which buffer holds positions. It uses whatever is bound at that moment, so the order of the calls matters.' },
          { text: 'Only the shades would be wrong',
            why: 'a_shade is still set up correctly. It is a_position that gets connected to the wrong buffer.' },
        ],
      },
      {
        ask: 'In `vertexAttribPointer(a_position, 3, gl.FLOAT, false, 0, 0)`, what does the `3` mean?',
        choices: [
          { text: 'Each vertex uses 3 numbers from the buffer (x, y, z)', correct: true,
            why: 'The size argument is how many values make one vertex\'s attribute. It matches `vec3 a_position` in the shader.' },
          { text: 'Each triangle has 3 vertices',
            why: 'Triangles are set by gl.TRIANGLES in drawArrays. This 3 is per vertex.' },
          { text: 'The buffer starts at byte 3',
            why: 'The offset is the last argument (0 here).' },
        ],
      },
      {
        ask: 'What does `gl.STATIC_DRAW` do?',
        choices: [
          { text: 'It is a hint that the data will be uploaded once and drawn many times', correct: true,
            why: 'The driver may use it to decide where to keep the data. It is not a rule: you could still change the data later.' },
          { text: 'It makes the buffer read-only',
            why: 'It is only a hint about how the buffer will be used. It doesn\'t lock anything.' },
          { text: 'It draws the data right away',
            why: 'Nothing is drawn until drawArrays.' },
        ],
      },
      {
        ask: 'The camera moves every frame. How often does this code need to run?',
        choices: [
          { text: 'Once: moving the camera only changes the view matrix, not the cube data', correct: true,
            why: 'The scene never changes shape, so the buffers stay the same. Each frame just draws them with a new view matrix.' },
          { text: 'Every frame, because the vertices move',
            why: 'The vertices in the buffer never change. Where they appear on screen changes because the view matrix changes.' },
          { text: 'Once per object, because each object has its own position',
            why: 'Every object uses the same buffers. Each one\'s position comes from its model matrix.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Describing the scene',
    language: 'javascript',
    code: `
const sceneObjects = [
  { position: [ 0.0, -0.05,  0.0], scale: [8.0, 0.1, 8.0], color: [0.55, 0.55, 0.55] },

  { position: [ 0.0,  1.0,   0.0], scale: [1.0, 2.0, 1.0], color: [0.90, 0.25, 0.20] },

  { position: [ 2.0,  0.5,   1.0], scale: [1.0, 1.0, 1.0], color: [0.20, 0.55, 0.90] },
  { position: [-2.0,  0.35,  1.5], scale: [0.7, 0.7, 0.7], color: [0.25, 0.80, 0.35] },
  { position: [-1.0,  0.25, -2.0], scale: [1.5, 0.5, 0.8], color: [0.95, 0.80, 0.20] },
];`,
    annotated: `
const sceneObjects = [   // the list of objects to draw; each is the same unit cube, placed, sized, and colored
  // Floor: a wide, very thin gray box; its center is 0.05 below 0, so its top surface is at y = 0
  { position: [ 0.0, -0.05,  0.0], scale: [8.0, 0.1, 8.0], color: [0.55, 0.55, 0.55] },

  // Red tower: 2 units tall, so its center is at y = 1 and it stands on the floor, at the center of the orbit
  { position: [ 0.0,  1.0,   0.0], scale: [1.0, 2.0, 1.0], color: [0.90, 0.25, 0.20] },

  // Blue box: a plain 1 × 1 × 1 cube with its center at y = 0.5
  { position: [ 2.0,  0.5,   1.0], scale: [1.0, 1.0, 1.0], color: [0.20, 0.55, 0.90] },
  // Green box: scaled to 0.7 on every axis (a smaller cube)
  { position: [-2.0,  0.35,  1.5], scale: [0.7, 0.7, 0.7], color: [0.25, 0.80, 0.35] },
  // Yellow box: a different scale on each axis: 1.5 wide, 0.5 tall, 0.8 deep
  { position: [-1.0,  0.25, -2.0], scale: [1.5, 0.5, 0.8], color: [0.95, 0.80, 0.20] },
];`,
    concepts: [
      {
        label: 'A list of the objects in the scene',
        hint: 'sceneObjects is plain data: one entry per object. The render loop reads it every frame and draws each one.',
        patterns: [/list|array|objects|scene|entries/],
      },
      {
        label: 'Each object has a position, a scale, and a color',
        hint: 'Position is where the center goes; scale is the size along x, y, z; color is (r, g, b) from 0 to 1.',
        patterns: [/position|where|place|locat/, /scale|size|big|dimension|stretch/],
      },
      {
        label: 'Every object is the same unit cube',
        hint: 'There is only one set of vertex data. The floor, the tower, and the boxes are all that cube with different positions and scales.',
        patterns: [/same (unit )?cube|one cube|unit cube|reus|all cubes|all boxes/],
      },
      {
        label: 'Boxes sit on the floor: their center height is half their height',
        hint: 'The floor\'s top is at y = 0. The cube is centered on its position, so a box of height h rests on the floor when its center is at y = h / 2.',
        patterns: [/half|floor|sit|rest|y ?= ?0|center|centre|height/],
      },
      {
        label: 'The scene never moves; only the camera does',
        hint: 'These values never change, so the objects stand still. The motion you see comes from the camera.',
        patterns: [/never (move|change)|static|still|fixed|camera/],
      },
    ],
    modelAnswer:
      'This is the list of objects in the scene: a floor, a tall red tower in the middle, and three smaller boxes around it. Each object is the same unit cube, described by a position (where its center goes), a scale (its size along x, y, and z), and a color. The floor\'s top surface is at y = 0, so each box\'s center is at half its height to make it rest on the floor. These values never change; the scene stands still and only the camera moves.',
    questions: [
      {
        ask: 'You want the blue box to be 3 units tall and still rest on the floor. What should its `position` and `scale` be?',
        choices: [
          { text: 'position `[2.0, 1.5, 1.0]`, scale `[1.0, 3.0, 1.0]`', correct: true,
            why: 'The cube is centered on its position, so a box 3 tall must have its center at 3 / 2 = 1.5 to have its bottom at y = 0.' },
          { text: 'position `[2.0, 0.5, 1.0]`, scale `[1.0, 3.0, 1.0]`',
            why: 'Scaling grows the box up and down from its center. With its center still at 0.5, its bottom would be at −1, below the floor.' },
          { text: 'position `[2.0, 3.0, 1.0]`, scale `[1.0, 3.0, 1.0]`',
            why: 'The position is the box\'s center, not its top. With the center at 3, the bottom would be at 1.5, floating above the floor.' },
        ],
      },
      {
        ask: 'Why is the floor\'s position `y = -0.05`, not `0`?',
        choices: [
          { text: 'The floor is 0.1 thick; moving its center down by half that puts its top surface exactly at y = 0', correct: true,
            why: 'That way every box can use "center at half its height" to sit on the floor.' },
          { text: 'So the camera can see it from above',
            why: 'The camera is 4 units up; 0.05 makes no difference to that. It is about where the floor\'s top surface is.' },
          { text: 'A y of exactly 0 would make the floor invisible',
            why: 'A floor at y = 0 would still be visible; its top would just be at y = 0.05.' },
        ],
      },
      {
        ask: 'What would you change to add a sixth box to the scene?',
        choices: [
          { text: 'Add one more entry to `sceneObjects`', correct: true,
            why: 'The render loop draws every entry in the list. No new vertex data or buffers are needed, since it is the same cube.' },
          { text: 'Add 36 more vertices to `cubePositions`',
            why: 'Every object reuses the same 36 vertices. A new object only needs a position, a scale, and a color.' },
          { text: 'Create a new buffer for the new box',
            why: 'All objects share one set of buffers. Only the uniforms differ per object.' },
        ],
      },
      {
        ask: 'The green box has scale `[0.7, 0.7, 0.7]` and the yellow box has `[1.5, 0.5, 0.8]`. What is the difference in their shapes?',
        choices: [
          { text: 'The green box is still a cube (just smaller); the yellow box is a flat rectangular block', correct: true,
            why: 'Scaling all three axes by the same amount keeps the shape. Different amounts per axis stretch it into a box.' },
          { text: 'Both are cubes; scale only changes size',
            why: 'Scale changes size separately along each axis. Different values stretch the shape.' },
          { text: 'The yellow box is rotated',
            why: 'Nothing here rotates anything; the model matrix only scales and moves.' },
        ],
      },
      {
        ask: 'When the program runs, do these positions change over time?',
        choices: [
          { text: 'No; the objects never move, and the motion comes from the camera', correct: true,
            why: 'Nothing changes sceneObjects. Each frame, only the view matrix (the camera) is different.' },
          { text: 'Yes; they rotate around the tower',
            why: 'It looks that way on screen, but it is the camera going around them.' },
          { text: 'Yes; the render loop adds the camera position to each one',
            why: 'The camera is handled by the view matrix in the shader. The scene data is never edited.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Vector helpers',
    language: 'javascript',
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
    annotated: `
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }   // a minus b: the vector from point b to point a
function dot(a, b)      { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }   // dot product: one number, 0 when a and b are perpendicular
function cross(a, b) {  // cross product: a vector perpendicular to both a and b
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function normalize(v) {
  const length = Math.sqrt(dot(v, v));                    // the vector's length: square root of x² + y² + z²
  return [v[0] / length, v[1] / length, v[2] / length];   // same direction, length exactly 1
}`,
    concepts: [
      {
        label: 'Small math functions on 3D vectors stored as [x, y, z] arrays',
        hint: 'These helpers do basic vector math, one component at a time, on plain 3-element arrays.',
        patterns: [/vector|helper|math|3d|x, ?y, ?z/],
      },
      {
        label: 'Cross product: a vector perpendicular to two others',
        hint: 'cross(a, b) is perpendicular to both a and b. lookAt uses it to build the camera\'s right and up directions.',
        patterns: [/cross|perpendicular|orthogonal|right angle/],
      },
      {
        label: 'Normalize: make a vector length 1, same direction',
        hint: 'normalize divides by the length so the result is a unit vector, which lookAt needs for its axes.',
        patterns: [/normaliz|unit|length (of )?1|length one/],
      },
      {
        label: 'Dot product and subtraction',
        hint: 'dot multiplies matching parts and adds them (one number); subtract gives the vector from one point to another.',
        patterns: [/dot|subtract|differen|minus/],
      },
      {
        label: 'Used by lookAt to build the camera',
        hint: 'These exist so lookAt can find the camera\'s three axes from eye, target, and up.',
        patterns: [/lookat|look at|camera|view/],
      },
    ],
    modelAnswer:
      'These are small helper functions for 3D vectors stored as [x, y, z] arrays, used by lookAt to build the camera. subtract gives the vector from one point to another. dot multiplies matching components and adds them, giving one number (zero when the vectors are perpendicular). cross returns a new vector perpendicular to both inputs. normalize divides a vector by its length so it keeps its direction but has length 1.',
    questions: [
      {
        ask: 'What is `cross([1, 0, 0], [0, 1, 0])`?',
        choices: [
          { text: '`[0, 0, 1]`', correct: true,
            why: 'x = 0·0 − 0·1 = 0, y = 0·0 − 1·0 = 0, z = 1·1 − 0·0 = 1. The x axis cross the y axis gives the z axis.' },
          { text: '`[0, 0, -1]`',
            why: 'That is cross([0, 1, 0], [1, 0, 0]): swapping the order flips the direction.' },
          { text: '`0`',
            why: 'That is the dot product. The cross product returns a vector.' },
        ],
      },
      {
        ask: 'What does `dot(a, b)` return when `a` and `b` are perpendicular?',
        choices: [
          { text: '0', correct: true,
            why: 'The dot product is |a|·|b|·cos(angle), and cos(90°) = 0.' },
          { text: '1',
            why: 'For two unit vectors, 1 means they point the same way.' },
          { text: 'A vector perpendicular to both',
            why: 'That is the cross product. The dot product returns a single number.' },
        ],
      },
      {
        ask: 'What happens if `normalize` is given `[0, 0, 0]`?',
        choices: [
          { text: 'It divides by 0 and returns `[NaN, NaN, NaN]`', correct: true,
            why: '0 / 0 is NaN in JavaScript. Nothing checks for this, and NaN in the camera matrix would make the whole scene disappear.' },
          { text: 'It returns `[0, 0, 0]`',
            why: 'The code divides by the length, which is 0. 0 / 0 gives NaN, not 0.' },
          { text: 'JavaScript throws a division-by-zero error',
            why: 'JavaScript does not throw on division by zero. It gives Infinity or NaN.' },
        ],
      },
      {
        ask: 'Does the order of the arguments matter in `cross(a, b)`?',
        choices: [
          { text: 'Yes: `cross(b, a)` points in the opposite direction', correct: true,
            why: 'cross(b, a) = −cross(a, b). In lookAt, swapping the order would make the camera\'s "right" point left, and the picture would come out mirrored.' },
          { text: 'No, it gives the same vector either way',
            why: 'That is true for the dot product, but not for the cross product.' },
          { text: 'Only the length changes',
            why: 'The length is the same either way. The direction flips.' },
        ],
      },
      {
        ask: 'Why does `normalize` compute the length as `Math.sqrt(dot(v, v))`?',
        choices: [
          { text: '`dot(v, v)` is x² + y² + z², the length squared', correct: true,
            why: 'The square root of x² + y² + z² is the length, by the Pythagorean theorem in 3D.' },
          { text: '`dot(v, v)` is always 1',
            why: 'Only if v already has length 1. In general it is the length squared.' },
          { text: 'It makes the vector perpendicular to itself',
            why: 'A vector can\'t be perpendicular to itself (unless it is zero). dot(v, v) gives its length squared.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'The model matrix',
    language: 'javascript',
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
    annotated: `
function makeModelMatrix(position, scale) {   // build the matrix that scales the unit cube, then moves it into place
  const [tx, ty, tz] = position;              // unpack the translation: where the object's center goes
  const [sx, sy, sz] = scale;                 // unpack the scale factors along x, y, and z
  return new Float32Array([                   // 16 numbers, listed column by column (column-major, as WebGL expects)
    sx, 0,  0,  0,                            // column 1: scale x by sx
    0,  sy, 0,  0,                            // column 2: scale y by sy
    0,  0,  sz, 0,                            // column 3: scale z by sz
    tx, ty, tz, 1,                            // column 4: the translation, added to points with w = 1
  ]);
}`,
    concepts: [
      {
        label: 'Builds a matrix that places one object in the world',
        hint: 'The model matrix takes the unit cube from its own space into the world: object space → world space.',
        patterns: [/model|world|place|object space|position/],
      },
      {
        label: 'Scales the cube to the object\'s size',
        hint: 'sx, sy, sz on the diagonal stretch the cube along x, y, and z.',
        patterns: [/scal|size|stretch|resiz|bigger|smaller/],
      },
      {
        label: 'Translates (moves) the cube to its position',
        hint: 'tx, ty, tz in the last column move the cube so its center lands at `position`.',
        patterns: [/translat|move|shift|position|offset/],
      },
      {
        label: 'Scaling happens first, then moving',
        hint: 'This matrix scales around the cube\'s own center and then moves it. Moving first would also scale the position.',
        patterns: [/first|then|before|after|order/],
      },
      {
        label: 'Stored column by column (column-major)',
        hint: 'WebGL reads the 16 numbers one column at a time, so each line of code here is a column; the translation is the fourth column.',
        patterns: [/column|major|order|transpos/],
      },
    ],
    modelAnswer:
      'This builds the model matrix for one object, which takes the unit cube from its own space into the world. The scale factors sit on the diagonal and stretch the cube along x, y, and z, and the translation in the last column moves it so its center lands at the given position. The result scales first and then moves. The 16 numbers are listed column by column (column-major), the order WebGL expects, so each line of code is one column.',
    questions: [
      {
        ask: 'Which part of the matrix moves the object, and where is it in the list of 16 numbers?',
        choices: [
          { text: 'tx, ty, tz: the fourth column, which is the last four numbers in the list', correct: true,
            why: 'In column-major order the fourth column comes last. Written as code it looks like the bottom row, but it is the right-hand column of the real matrix.' },
          { text: 'tx, ty, tz: the bottom row of the matrix',
            why: 'It looks like the bottom row in the code, but the list is column-major, so that line is the fourth column.' },
          { text: 'sx, sy, sz on the diagonal',
            why: 'The diagonal scales. Translation is in the fourth column.' },
        ],
      },
      {
        ask: 'Applied to the cube\'s corner (0.5, 0.5, 0.5), what does the tower\'s model matrix give? (Tower: position [0, 1, 0], scale [1, 2, 1].)',
        choices: [
          { text: '(0.5, 2, 0.5)', correct: true,
            why: 'Scale first: (0.5·1, 0.5·2, 0.5·1) = (0.5, 1, 0.5). Then move by (0, 1, 0): (0.5, 2, 0.5). That is the top of the 2-unit tower.' },
          { text: '(0.5, 3, 0.5)',
            why: 'That would scale the position too. Here the translation is added after scaling, so it is not doubled.' },
          { text: '(0.5, 1.5, 0.5)',
            why: 'That moves the corner without scaling it. The tower is scaled by 2 in y first.' },
        ],
      },
      {
        ask: 'Why does the scale go on the diagonal?',
        choices: [
          { text: 'Each diagonal entry multiplies one coordinate by itself: x by sx, y by sy, z by sz', correct: true,
            why: 'Row 1 of the matrix gives the new x: sx·x + 0·y + 0·z + tx·1. The zeros keep x, y, and z from mixing.' },
          { text: 'It is a WebGL rule that scaling goes on the diagonal',
            why: 'It follows from how matrix multiplication works, not from a WebGL rule.' },
          { text: 'The diagonal holds the rotation',
            why: 'Rotation would fill more of the 3×3 part. This matrix has no rotation.' },
        ],
      },
      {
        ask: 'What would this matrix do to a point if its w were 0 instead of 1?',
        choices: [
          { text: 'Scale it but not move it', correct: true,
            why: 'The translation column is multiplied by w. With w = 0 it adds nothing. That is how directions (w = 0) are treated differently from points (w = 1).' },
          { text: 'Move it but not scale it',
            why: 'Scaling uses x, y, z, which don\'t depend on w. Only the translation depends on w.' },
          { text: 'Nothing; w doesn\'t matter',
            why: 'w controls whether the translation column is added.' },
        ],
      },
      {
        ask: 'This function is called inside the render loop. How often does it run?',
        choices: [
          { text: 'Once per object per frame: 5 times every frame', correct: true,
            why: 'The loop calls it for each object before drawing. The result is the same each frame, since the objects never move; it is just cheap enough not to bother saving.' },
          { text: 'Once per vertex',
            why: 'Matrices are built in JavaScript, once per object. The vertex shader does the per-vertex work.' },
          { text: 'Once at startup',
            why: 'It could be done once, since the objects never move, but here it is called inside the loop each frame.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'The view matrix (lookAt)',
    language: 'javascript',
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
    annotated: `
function lookAt(eye, target, up) {   // build the view matrix: a camera at eye, looking at target
  const zAxis = normalize(subtract(eye, target));   // camera's backward direction: from the target toward the eye (the camera looks down -z)
  const xAxis = normalize(cross(up, zAxis));        // camera's right direction: perpendicular to up and backward
  const yAxis = cross(zAxis, xAxis);                // camera's true up: perpendicular to the other two (already length 1)

  return new Float32Array([
    // Columns 1-3: the camera's axes as the rows of the 3×3 part, which rotates world directions into camera directions
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    // Column 4: the translation that moves the eye to the origin
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
  ]);
}`,
    concepts: [
      {
        label: 'Builds the view matrix: the camera',
        hint: 'lookAt makes the view matrix, which is how the camera is represented. Changing the camera means calling lookAt with new values.',
        patterns: [/view|camera/],
      },
      {
        label: 'Described by eye (where), target (looking at), and up',
        hint: 'The camera is given the way a person would describe it: where it stands, what it looks at, and which way is up.',
        patterns: [/eye|target|look(s|ing)? at|up/],
      },
      {
        label: 'Computes the camera\'s three perpendicular axes',
        hint: 'zAxis (backward), xAxis (right), and yAxis (up) are unit vectors at right angles to each other, built with subtract, cross, and normalize.',
        patterns: [/axis|axes|right|backward|perpendicular|cross|direction/],
      },
      {
        label: 'Moves the world so the camera is at the origin looking down −z',
        hint: 'The view matrix does the opposite of placing the camera: it rotates and moves the whole world so the camera ends up at the origin, looking down −z.',
        patterns: [/origin|opposite|inverse|world.*mov|mov.*world|-z|−z|negative z/],
      },
      {
        label: 'Rotation in the 3×3 part, translation in the last column',
        hint: 'The camera axes form the rows of the 3×3 part (rotation); −dot(axis, eye) in the fourth column moves the eye to the origin.',
        patterns: [/rotat|translat|3x3|3×3|column/],
      },
    ],
    modelAnswer:
      'This builds the view matrix, which is the camera. The camera is described by where it is (eye), what it looks at (target), and which way is up. From those, it computes three perpendicular unit vectors, the camera\'s own axes: backward (from target to eye), right, and up. The matrix puts these axes in the rows of its 3×3 part to rotate the world into the camera\'s directions, and its last column translates so the eye lands at the origin. The result moves the whole world so the camera sits at the origin looking down −z.',
    questions: [
      {
        ask: 'The camera moves to the right. What does the view matrix do to the world?',
        choices: [
          { text: 'Moves the whole world to the left', correct: true,
            why: 'The view matrix does the opposite of the camera\'s motion. In the picture, moving the camera right looks the same as moving the world left.' },
          { text: 'Moves the whole world to the right too',
            why: 'If both moved the same way, nothing would change on screen. The view matrix applies the opposite motion.' },
          { text: 'Nothing; the view matrix only rotates',
            why: 'Its last column translates. It moves the world so the eye is at the origin.' },
        ],
      },
      {
        ask: 'Why does `zAxis` point from the target toward the eye (backward), not toward the target?',
        choices: [
          { text: 'By convention a WebGL camera looks down its own −z axis, so +z points behind it', correct: true,
            why: 'With +z pointing backward, things in front of the camera have negative z in camera space. The projection matrix is built for that.' },
          { text: 'It is a bug; it should point toward the target',
            why: 'It is on purpose. The perspective matrix expects visible points to have negative z.' },
          { text: 'So the camera looks away from the scene',
            why: 'The camera looks down −z, which is toward the target.' },
        ],
      },
      {
        ask: 'Why is `xAxis` normalized, but `yAxis` is not?',
        choices: [
          { text: '`up` is usually not perpendicular to `zAxis`, so their cross product is shorter than 1; `zAxis` and `xAxis` are perpendicular unit vectors, so their cross product is already length 1', correct: true,
            why: 'The length of a cross product is |a|·|b|·sin(angle). For two perpendicular unit vectors that is 1·1·1 = 1.' },
          { text: '`yAxis` should also be normalized; leaving it out is a bug',
            why: 'It would do no harm, but it isn\'t needed: the cross product of two perpendicular unit vectors already has length 1.' },
          { text: 'Only the x axis needs length 1',
            why: 'All three axes must have length 1, or the view would be stretched.' },
        ],
      },
      {
        ask: 'What would go wrong if the camera were straight above the target, so `eye − target` points straight up, the same direction as `up`?',
        choices: [
          { text: '`cross(up, zAxis)` is zero, normalize divides by zero, and the matrix fills with NaN, so nothing is drawn', correct: true,
            why: 'Parallel vectors have a zero cross product, so there is no way to work out "right". Here the camera is never straight overhead, so it never happens.' },
          { text: 'The picture would be upside down',
            why: 'It is worse than that: the right direction can\'t be computed at all.' },
          { text: 'Nothing; lookAt works for any camera position',
            why: 'It fails when the view direction is parallel to up.' },
        ],
      },
      {
        ask: 'What does the view matrix do to the point `eye` itself?',
        choices: [
          { text: 'Moves it to the origin (0, 0, 0)', correct: true,
            why: 'The rotation gives (dot(xAxis, eye), dot(yAxis, eye), dot(zAxis, eye)), and the last column subtracts exactly those. In camera space, the camera is at the origin.' },
          { text: 'Leaves it where it is',
            why: 'The whole point of the view matrix is to move the world so the eye ends up at the origin.' },
          { text: 'Moves it to the target',
            why: 'The eye goes to the origin, and the target ends up straight in front, on the −z axis.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Perspective projection',
    language: 'javascript',
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
    annotated: `
function perspective(fieldOfView, aspect, near, far) {   // build the projection matrix: the camera's lens
  const f = 1.0 / Math.tan(fieldOfView / 2);              // zoom factor from the vertical field of view: narrower view = bigger f
  const rangeInv = 1.0 / (near - far);                    // used to map depths between near and far
  return new Float32Array([
    f / aspect, 0, 0,                          0,         // column 1: scale x by f / aspect, so a wide canvas doesn't stretch the picture
    0,          f, 0,                          0,         // column 2: scale y by f
    0,          0, (near + far) * rangeInv,   -1,         // column 3: depth mapping, and the -1 sets w = -z (the distance in front of the camera)
    0,          0, 2 * near * far * rangeInv,  0,         // column 4: the rest of the depth mapping (near to -1, far to +1 after dividing by w)
  ]);
}`,
    concepts: [
      {
        label: 'Builds the projection matrix: the camera\'s lens',
        hint: 'The projection matrix turns camera space into clip space. It decides how much the camera sees and adds perspective.',
        patterns: [/projection|lens|clip/],
      },
      {
        label: 'Adds perspective: far things look smaller',
        hint: 'It sets w to the distance in front of the camera; the GPU divides by w, so farther points shrink toward the center.',
        patterns: [/perspective|far.*small|small.*far|distan|divid/],
      },
      {
        label: 'Field of view controls how wide the camera sees',
        hint: 'fieldOfView is the vertical angle. A bigger angle is a wide-angle lens; a smaller one zooms in.',
        patterns: [/field of view|fov|angle|zoom|wide/],
      },
      {
        label: 'Aspect ratio keeps the picture from stretching',
        hint: 'Dividing x by width ÷ height makes squares stay square on a canvas that isn\'t square.',
        patterns: [/aspect|stretch|width|ratio/],
      },
      {
        label: 'Near and far: only things between them are drawn',
        hint: 'Points closer than near or farther than far are clipped (cut off).',
        patterns: [/near|far|clip|cut|range|depth/],
      },
    ],
    modelAnswer:
      'This builds the projection matrix, the camera\'s lens. The field of view sets how wide the camera sees (vertically), and dividing by the aspect ratio keeps the picture from stretching on a non-square canvas. Only things between the near and far distances are drawn. The matrix also puts the distance in front of the camera into w; after the GPU divides by w, farther things are smaller, which is perspective, and everything visible fits in a cube from −1 to +1.',
    questions: [
      {
        ask: 'You change the field of view from 45° to 90°. What happens to the picture?',
        choices: [
          { text: 'You see more of the scene, and everything looks smaller', correct: true,
            why: 'A wider angle gives a smaller f, so everything is scaled down: a wide-angle lens.' },
          { text: 'Everything looks bigger, as if zoomed in',
            why: 'That is what a smaller field of view does. A bigger angle zooms out.' },
          { text: 'The camera moves farther away',
            why: 'The camera stays at the same spot. Only the lens changes.' },
        ],
      },
      {
        ask: 'What actually makes far-away boxes look smaller?',
        choices: [
          { text: 'The −1 sets w to the distance in front of the camera, and the GPU divides x and y by w', correct: true,
            why: 'Points that are twice as far are divided by twice as much, so they appear half as big. This step is called the perspective divide.' },
          { text: 'The model matrix scales far boxes down',
            why: 'The model matrix only depends on the object, not on the camera. Size changes come from the projection and the divide by w.' },
          { text: 'The near value',
            why: 'near sets where clipping starts. The shrinking comes from dividing by w.' },
        ],
      },
      {
        ask: 'Why divide by `aspect` in `f / aspect`?',
        choices: [
          { text: 'On a wide canvas, the −1 to +1 range is stretched over more pixels sideways, so x must be squeezed to keep squares square', correct: true,
            why: 'Without it, the picture would be stretched horizontally on a wide window.' },
          { text: 'To make the field of view horizontal',
            why: 'fieldOfView is still the vertical angle. Dividing by aspect sets the matching horizontal extent.' },
          { text: 'To make far things smaller',
            why: 'That comes from the divide by w. aspect only affects x.' },
        ],
      },
      {
        ask: 'The program uses near = 0.1 and far = 100. What happens to a box 150 units from the camera?',
        choices: [
          { text: 'It is not drawn, because it is farther than `far`', correct: true,
            why: 'Anything outside near and far is clipped. This scene is only a few units across, so it never happens here.' },
          { text: 'It is drawn very small',
            why: 'Things beyond far are cut off, not just made small.' },
          { text: 'It is drawn at distance 100 instead',
            why: 'Nothing is moved; points beyond far are clipped.' },
        ],
      },
      {
        ask: 'Why is this matrix computed every frame instead of just once?',
        choices: [
          { text: 'The canvas can change size, which changes the aspect ratio', correct: true,
            why: 'The camera moving does not change the lens. Only the canvas shape does; rebuilding the matrix every frame is a simple way to handle resizing.' },
          { text: 'Because the camera moves',
            why: 'The camera\'s position is in the view matrix. The projection doesn\'t depend on where the camera is.' },
          { text: 'WebGL forgets uniforms after each frame',
            why: 'Uniforms keep their values until they are set again.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Depth test, background, and canvas size',
    language: 'javascript',
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
    annotated: `
gl.enable(gl.DEPTH_TEST);              // turn on the depth test: nearer surfaces hide farther ones, whatever the draw order

gl.clearColor(0.1, 0.12, 0.16, 1.0);   // set the color gl.clear will use: dark blue-gray (it doesn't clear anything yet)

function resizeCanvas() {
  const width = canvas.clientWidth;    // the canvas's width on the page, in CSS pixels
  const height = canvas.clientHeight;
  // Only resize when the size changed, since setting the size clears the canvas
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;              // make the drawing buffer as many pixels wide as the canvas is shown
    canvas.height = height;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);   // draw into the whole canvas: map -1..+1 to its pixels
}`,
    concepts: [
      {
        label: 'Depth test: near things hide far things',
        hint: 'DEPTH_TEST keeps the closest surface at each pixel, so the right boxes are in front no matter what order they are drawn in.',
        patterns: [/depth|z.?buffer|hidden|occlu|hide|in front|behind|closer|nearer|closest/],
      },
      {
        label: 'Sets the background color',
        hint: 'clearColor picks the dark blue-gray that gl.clear fills the canvas with each frame.',
        patterns: [/background|clear ?colou?r|colou?r|blue|gray|grey/],
      },
      {
        label: "Matches the canvas's drawing size to its size on the page",
        hint: 'canvas.width/height set how many pixels WebGL draws; matching clientWidth/Height avoids a blurry, stretched image.',
        patterns: [/resiz|size|width|dimension|match|blur|stretch/],
      },
      {
        label: 'Sets the viewport: the area of the canvas to draw into',
        hint: 'gl.viewport maps the −1..+1 range from the shaders onto the canvas\'s pixels.',
        patterns: [/viewport|pixel|region|rectangle|area|map/],
      },
      {
        label: 'Settings are set once; resizing is checked every frame',
        hint: 'WebGL remembers DEPTH_TEST and the clear color, so they are set once. resizeCanvas runs every frame, so window resizes are handled.',
        patterns: [/once|every frame|each frame|remember|window/],
      },
    ],
    modelAnswer:
      'This sets up drawing. It turns on the depth test so nearer surfaces hide farther ones whatever order the boxes are drawn in, and sets the dark blue-gray background color that gl.clear will use; WebGL remembers both, so they are set once. The resizeCanvas function, called every frame, makes the canvas draw as many pixels as it takes up on the page (resizing only when that changed) and sets the viewport so drawing covers the whole canvas.',
    questions: [
      {
        ask: 'What happens if you leave out `gl.enable(gl.DEPTH_TEST)`?',
        choices: [
          { text: 'Boxes drawn later cover earlier ones, even when they are farther away', correct: true,
            why: 'Without the depth test, the last thing drawn at a pixel wins. As the camera orbits, boxes behind the tower would show through it.' },
          { text: 'Nothing is drawn',
            why: 'Everything is still drawn, just in draw order instead of by distance.' },
          { text: 'The far boxes are not drawn',
            why: 'Everything is drawn; the problem is which one ends up on top.' },
        ],
      },
      {
        ask: 'What does `gl.clearColor(0.1, 0.12, 0.16, 1.0)` do on its own?',
        choices: [
          { text: 'It only sets the color; nothing is erased until `gl.clear` is called', correct: true,
            why: 'clearColor stores the color. gl.clear(gl.COLOR_BUFFER_BIT) fills the canvas with it, every frame.' },
          { text: 'It fills the canvas with dark blue-gray',
            why: 'Setting the color does not draw anything. gl.clear does the erasing.' },
          { text: 'It sets the color of the floor',
            why: 'Object colors come from u_color. This is the background.' },
        ],
      },
      {
        ask: 'Why check whether the size changed before setting `canvas.width`?',
        choices: [
          { text: 'Setting the size clears the canvas and reallocates its memory, so it is skipped when nothing changed', correct: true,
            why: 'resizeCanvas runs every frame, but the window size rarely changes. Skipping the assignment avoids needless work.' },
          { text: 'Setting the same size twice causes an error',
            why: 'It is allowed, just wasteful: the drawing buffer is reset each time.' },
          { text: 'clientWidth is only correct the first time',
            why: 'clientWidth is always the current displayed width.' },
        ],
      },
      {
        ask: 'You make the browser window wider, but `gl.viewport` is never called again. What do you see?',
        choices: [
          { text: 'The picture only fills the old-size area of the canvas', correct: true,
            why: 'The viewport is the rectangle WebGL draws into. It stays at the old size until it is set again.' },
          { text: 'The picture stretches to fill the new size automatically',
            why: 'WebGL does not update the viewport on its own when the canvas resizes.' },
          { text: 'Nothing changes; the viewport is not needed',
            why: 'The viewport decides where the −1..+1 range lands on the canvas.' },
        ],
      },
      {
        ask: '`clientWidth` is in CSS pixels. On a high-DPI (Retina) screen, what does that mean for this program?',
        choices: [
          { text: 'The canvas draws fewer pixels than the screen has there, so the image is a little soft', correct: true,
            why: 'One CSS pixel can be 2 or more device pixels. Multiplying by window.devicePixelRatio would make the image fully sharp.' },
          { text: 'The canvas draws too many pixels and runs slowly',
            why: 'It is the other way around: CSS pixels are larger than device pixels on those screens.' },
          { text: 'Nothing; CSS pixels and screen pixels are always the same',
            why: 'They are the same on standard screens, but not on high-DPI ones.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Moving the camera',
    language: 'javascript',
    code: `
const ORBIT_RADIUS = 9.0;
const ORBIT_HEIGHT = 4.0;
const ORBIT_SPEED  = 0.3;
const LOOK_AT      = [0, 0.5, 0];
const UP           = [0, 1, 0];

// ... (inside render)

const seconds = timeInMilliseconds / 1000;
const angle = seconds * ORBIT_SPEED;
const eye = [
  ORBIT_RADIUS * Math.cos(angle),
  ORBIT_HEIGHT,
  ORBIT_RADIUS * Math.sin(angle),
];

const viewMatrix = lookAt(eye, LOOK_AT, UP);`,
    annotated: `
const ORBIT_RADIUS = 9.0;          // distance of the camera from the vertical axis through the scene's center
const ORBIT_HEIGHT = 4.0;          // how high the camera is: above the target, so it looks down at the scene
const ORBIT_SPEED  = 0.3;          // radians per second: about 21 seconds per full circle
const LOOK_AT      = [0, 0.5, 0];  // the fixed point the camera always faces
const UP           = [0, 1, 0];    // which way is up for the camera: world +y

// ... (inside render)

const seconds = timeInMilliseconds / 1000;   // the time from requestAnimationFrame, in seconds
const angle = seconds * ORBIT_SPEED;         // the angle around the circle grows steadily with time
const eye = [
  ORBIT_RADIUS * Math.cos(angle),            // x on the circle: radius times cosine of the angle
  ORBIT_HEIGHT,                              // y stays fixed, so the circle is level
  ORBIT_RADIUS * Math.sin(angle),            // z on the circle: radius times sine of the angle
];

const viewMatrix = lookAt(eye, LOOK_AT, UP);   // this frame's camera: from the new eye position, aimed at the same point`,
    concepts: [
      {
        label: 'The camera moves in a circle around the scene',
        hint: 'The eye position goes around a circle of radius ORBIT_RADIUS, centered on the vertical axis through the scene.',
        patterns: [/circle|orbit|around|rotat|revolv|spin/],
      },
      {
        label: 'Cosine and sine of the angle give x and z',
        hint: 'A point on a circle is (r·cos θ, r·sin θ). Here the circle is flat (in the x-z plane), at a fixed height.',
        patterns: [/cos|sin|trig|x.*z|unit circle/],
      },
      {
        label: 'The angle grows with time',
        hint: 'angle = seconds × speed, so the camera keeps moving at a steady rate, no matter how fast frames are drawn.',
        patterns: [/time|second|grow|increas|speed|each frame|every frame/],
      },
      {
        label: 'It always looks at the same point',
        hint: 'The target (LOOK_AT) never changes, so the camera keeps facing the scene while it moves.',
        patterns: [/look(s|ing)? at|target|fac|point(s|ed)? at|center|centre/],
      },
      {
        label: 'Only the view matrix changes; the scene stays still',
        hint: 'A new view matrix from lookAt is the only thing that changes per frame. The objects never move.',
        patterns: [/view|lookat|matri|scene (doesn'?t|does not|never|stays)|stay|still/],
      },
    ],
    modelAnswer:
      'This moves the camera in a circle around the scene. The constants set the circle\'s radius, the camera\'s height, the speed in radians per second, the point it looks at, and which way is up. Each frame, the time in seconds times the speed gives an angle, and the radius times the cosine and sine of that angle give the camera\'s x and z, at a fixed height. lookAt then builds a new view matrix from that position, always aimed at the same point. Only the camera changes; the scene stays still.',
    questions: [
      {
        ask: 'You change `ORBIT_SPEED` to 0.6. What happens?',
        choices: [
          { text: 'The camera goes around twice as fast: about 10.5 seconds per circle', correct: true,
            why: 'The angle grows twice as fast. A full circle is 2π ≈ 6.28 radians, and 6.28 / 0.6 ≈ 10.5 seconds.' },
          { text: 'The circle gets twice as big',
            why: 'The size of the circle is ORBIT_RADIUS. Speed only changes how fast the angle grows.' },
          { text: 'The program draws twice as many frames per second',
            why: 'The frame rate is set by the browser and display. Speed only changes how far the camera moves per second.' },
        ],
      },
      {
        ask: 'Why does the angle come from the time instead of adding a fixed amount every frame?',
        choices: [
          { text: 'So the camera moves at the same speed on every screen, even if frames come faster or slower', correct: true,
            why: 'On a 120 Hz screen, render runs twice as often as on a 60 Hz one. Adding a fixed step per frame would orbit twice as fast there.' },
          { text: 'Because JavaScript has no way to count frames',
            why: 'A counter would be easy. Using time keeps the speed the same whatever the frame rate.' },
          { text: 'It makes the camera smoother on slow computers',
            why: 'On a slow computer it still jumps between frames; it just covers the same distance per second.' },
        ],
      },
      {
        ask: 'Why use `Math.cos(angle)` for x and `Math.sin(angle)` for z?',
        choices: [
          { text: '(r·cos θ, r·sin θ) is a point on a circle of radius r, so the camera stays the same distance from the center', correct: true,
            why: 'Since cos² + sin² = 1, the camera is always exactly ORBIT_RADIUS from the y axis.' },
          { text: 'Cosine makes the camera move left and right, and sine makes it move up and down',
            why: 'The second number, y, stays at ORBIT_HEIGHT. Cosine and sine are used for x and z, which are both horizontal.' },
          { text: 'They make the camera speed up and slow down',
            why: 'The camera moves at a constant speed around the circle.' },
        ],
      },
      {
        ask: 'What would you see if you set `ORBIT_HEIGHT` to 0.5, the same height as `LOOK_AT`?',
        choices: [
          { text: 'The camera would look straight across at the boxes from just above the floor, instead of down at them', correct: true,
            why: 'With the eye at the same height as the target, the view direction is level. The floor would be seen almost edge-on.' },
          { text: 'Nothing; the height doesn\'t matter because the camera always looks at the target',
            why: 'It still looks at the target, but from a different angle.' },
          { text: 'lookAt would fail and nothing would be drawn',
            why: 'lookAt only fails if the view direction is parallel to up (straight up or down). A level view is fine.' },
        ],
      },
      {
        ask: 'If you wanted the camera to stand still, what would be the simplest change?',
        choices: [
          { text: 'Set `ORBIT_SPEED` to 0', correct: true,
            why: 'Then the angle is always 0 and eye stays at (9, 4, 0). Everything else keeps working.' },
          { text: 'Stop calling lookAt',
            why: 'Then viewMatrix wouldn\'t exist and the shader would get no camera.' },
          { text: 'Remove the scene objects\' positions',
            why: 'The objects never move anyway. The motion comes from the camera.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Drawing one frame',
    language: 'javascript',
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

requestAnimationFrame(render);`,
    annotated: `
const aspect = canvas.width / canvas.height;   // the canvas's width divided by its height
// The lens: 45° vertical field of view, converted to radians; draw only between 0.1 and 100 units away
const projectionMatrix = perspective(45 * Math.PI / 180, aspect, 0.1, 100.0);

gl.uniformMatrix4fv(u_view, false, viewMatrix);               // send the camera matrix (the same for every object, so once per frame)
gl.uniformMatrix4fv(u_projection, false, projectionMatrix);   // send the lens matrix (false = don't transpose; required in WebGL 1)

gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);   // erase the last frame: colors to the background, depths to farthest

for (const object of sceneObjects) {   // draw each object in the scene list
  gl.uniformMatrix4fv(u_model, false, makeModelMatrix(object.position, object.scale));   // send this object's placement and size
  gl.uniform3fv(u_color, object.color);                                                  // send this object's color

  gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);   // draw the same 36 cube vertices again, as 12 triangles
}

requestAnimationFrame(render);   // ask the browser to call render again before the next screen refresh`,
    concepts: [
      {
        label: 'Sends the camera (view and projection) once per frame',
        hint: 'The view and projection matrices are the same for every object, so they are sent once, before the loop.',
        patterns: [/camera|projection|perspective|view/],
      },
      {
        label: 'Clears the previous frame (color and depth)',
        hint: 'gl.clear erases the old picture to the background color and resets the depth buffer.',
        patterns: [/clear|eras|wipe|reset|background/],
      },
      {
        label: "Draws each object with its own model matrix and color",
        hint: 'The loop sets u_model and u_color for each object, then draws.',
        patterns: [/each object|every object|loop|for each|model|colou?r/],
      },
      {
        label: 'The same cube data is drawn again for every object',
        hint: 'drawArrays draws the 36 vertices already on the GPU. Only the uniforms change from object to object.',
        patterns: [/same|reus|36|drawarrays|again/],
      },
      {
        label: 'requestAnimationFrame schedules the next frame, making an animation',
        hint: 'Each frame asks the browser to call render again before the next refresh, so the camera keeps moving.',
        patterns: [/requestanimationframe|next frame|again|loop|repeat|animat/],
      },
    ],
    modelAnswer:
      'This draws one frame. It builds the projection matrix from the canvas\'s shape (45° field of view, near 0.1, far 100) and sends it and this frame\'s view matrix to the shader once, since they are the same for every object. It clears the color and depth buffers to erase the last frame. Then for each object it sends that object\'s model matrix and color and draws the same 36 cube vertices again. Finally it asks the browser to call render again before the next screen refresh, which keeps the animation going.',
    questions: [
      {
        ask: 'Why are `u_view` and `u_projection` set before the loop, but `u_model` inside it?',
        choices: [
          { text: 'The camera is the same for all objects in a frame; each object has its own model matrix', correct: true,
            why: 'Uniforms keep their values until set again, so the camera only needs to be sent once per frame. The model matrix must change before each object is drawn.' },
          { text: 'u_model must be set last because it is applied last',
            why: 'u_model is applied first in the shader. It is in the loop because it differs per object.' },
          { text: 'WebGL only allows two uniforms to be set outside a loop',
            why: 'There is no such rule. It is about which values change per object.' },
        ],
      },
      {
        ask: 'Why is `gl.clear` called before the `for` loop, not after it?',
        choices: [
          { text: 'Clearing after the loop would erase the boxes that were just drawn', correct: true,
            why: 'Each frame starts from a blank canvas and an empty depth buffer, then draws on top. Clearing must come first.' },
          { text: 'The order doesn\'t matter; WebGL always clears before showing the frame',
            why: 'gl.clear runs right when it is called. Called after drawing, it would wipe out the frame.' },
          { text: 'gl.clear must come right after setting the uniforms',
            why: 'gl.clear does not use the uniforms at all. It must come before drawing because it erases the canvas.' },
        ],
      },
      {
        ask: 'What would happen if the last line, `requestAnimationFrame(render)`, were removed from inside `render`?',
        choices: [
          { text: 'The scene would be drawn once and then freeze', correct: true,
            why: 'render only runs when it is asked for. Each frame has to ask for the next one, or the loop stops.' },
          { text: 'Nothing; the browser calls render 60 times a second on its own',
            why: 'The browser calls it once per request. With no new request, it stops.' },
          { text: 'Nothing would be drawn at all',
            why: 'The first call (outside render) still runs once, so one frame is drawn.' },
        ],
      },
      {
        ask: 'How many times is `gl.drawArrays` called per frame, and how many triangles does each call draw?',
        choices: [
          { text: '5 calls (one per object), 12 triangles each', correct: true,
            why: 'There are 5 entries in sceneObjects. Each call draws VERTEX_COUNT = 36 vertices as 36 / 3 = 12 triangles.' },
          { text: '1 call that draws all 5 objects',
            why: 'Each object needs its own model matrix and color, so each one is a separate draw call.' },
          { text: '5 calls, 36 triangles each',
            why: '36 is the number of vertices. gl.TRIANGLES takes them 3 at a time: 12 triangles.' },
        ],
      },
      {
        ask: 'What does `45 * Math.PI / 180` compute?',
        choices: [
          { text: '45° in radians (about 0.785)', correct: true,
            why: 'Math.tan in perspective() expects radians, and 180° = π radians.' },
          { text: '45 radians',
            why: 'Multiplying by π / 180 converts degrees to radians. 45 radians would be over 2500°.' },
          { text: 'The aspect ratio',
            why: 'The aspect ratio is the next argument, aspect. This is the field of view.' },
        ],
      },
    ],
  },
];
