// =====================================================================
//  Cube color code walkthrough
// =====================================================================
//
// A step-by-step tour of two programs of "Ways to Color a Cube"
// (webGL-examples/examples/cube-color-alternatives/):
//   tab 5  5-custom-interpolation.js  the fragment shader interpolates
//                                     the colors itself, with one rule
//                                     chosen by uniform int uMode
//   tab 6  6-per-triangle-rules.js    the same, but even and odd
//                                     triangles get their own rule,
//                                     found with gl_VertexID
// The switch at the top loads index.html?tab=5 or ?tab=6 (and keeps the
// step). Without ?tab, tab 5 is shown. ?step=N opens step N.
//
// Each step shows ONE piece of the program (a function, or a few lines
// that do one job). Everything else is folded, so students read a
// little at a time. Next to the code: a short explanation, a picture
// drawn for that step, and a live cube that runs the tab's real shaders,
// set up to show what the step is about.
//
// tab5-source.js and tab6-source.js (loaded first) hold the two programs'
// text as TAB5_SOURCE_LINES and TAB6_SOURCE_LINES, one string per line.
// They are generated copies; see this folder's CLAUDE.md for how to
// refresh them.
//
// Sections:
//   1. Reading the tab's source (find lines, sections, shaders, blocks)
//   2. The steps (what each step shows, says and draws)
//   3. Picture helpers (SVG pieces, small triangles colored by a rule)
//   4. The cube's data (copied from tabs 5/6, section 2)
//   5. Matrix helpers (copied from tabs 5/6, section 3, plus two small ones)
//   6. Real WebGL 2: compile the tab's shaders and draw the cube
//   7. The overlay on the live cube
//   8. The code panel
//   9. Navigation: sections, dots, Prev / Next, the tab switch
//  10. State and the animation loop


// ---------------------------------------------------------------------
// 1. READING THE TAB'S SOURCE
//    Line numbers are never hard-coded. Steps name their lines by a
//    snippet of their text (e.g. "vBary = aBary;"), so the walkthrough
//    keeps working when the tab's comments change. A missing snippet
//    is reported in the console.
// ---------------------------------------------------------------------
const TAB = new URLSearchParams(window.location.search).get('tab') === '6' ? 6 : 5;
const TAB_INFO = {
    5: { lines: TAB5_SOURCE_LINES, file: '5-custom-interpolation.js' },
    6: { lines: TAB6_SOURCE_LINES, file: '6-per-triangle-rules.js' },
};
const SOURCE = TAB_INFO[TAB].lines;                          // SOURCE[0] is line 1
const RULE_VARIABLE = (TAB === 6) ? 'mode' : 'uMode';        // what interpolate() tests

const isCommentOnly = (text) => text.trim().startsWith('//');
const isBlank = (text) => text.trim() === '';
// The code part of a line, without its "// comment".
function codePart(text) {
    const at = text.indexOf('//');
    return (at < 0 ? text : text.slice(0, at)).trim();
}

// The 1-based number of the first line from `fromLine` to `toLine` that
// contains `snippet`. Comment-only lines are skipped: tab 5's comments
// contain example code such as "if (uMode == 5) { ... }".
function findLine(snippet, fromLine = 1, toLine = SOURCE.length) {
    for (let n = fromLine; n <= toLine; n++) {
        const text = SOURCE[n - 1];
        if (isCommentOnly(text)) continue;
        if (text.includes(snippet)) return n;
    }
    console.warn('Snippet not found in tab ' + TAB + ' source:', snippet);
    return null;
}

// The line holding the "}" that closes the block opened on line `start`.
function blockEnd(start) {
    let depth = 0;
    for (let n = start; n <= SOURCE.length; n++) {
        for (const ch of codePart(SOURCE[n - 1])) {
            if (ch === '{') depth++;
            if (ch === '}' && --depth === 0) return n;
        }
    }
    return start;
}

// The file is split into a header comment and sections 0-5. Each section
// starts with a "// ------" line followed by "// 0. ...", "// 1. ...".
const SECTIONS = [];
for (let n = 2; n <= SOURCE.length; n++) {
    const match = SOURCE[n - 1].match(/^\/\/ (\d)\. (.*)$/);
    if (match && SOURCE[n - 2].startsWith('// ----')) {
        SECTIONS.push({ number: Number(match[1]), title: match[1] + '. ' + match[2], start: n - 1 });
    }
}
SECTIONS.unshift({ number: null, title: 'Header comment: what this example shows', start: 1 });
for (let i = 0; i < SECTIONS.length; i++) {
    SECTIONS[i].end = (i + 1 < SECTIONS.length) ? SECTIONS[i + 1].start - 1 : SOURCE.length;
}

// A shader is the text between the backtick after "const <name> =" and
// the line "`;". This is exactly the string the tab compiles.
function extractShader(name) {
    const first = findLine('const ' + name + ' =');
    const last = findLine('`;', first);
    const lines = SOURCE.slice(first - 1, last - 1);
    lines[0] = lines[0].slice(lines[0].indexOf('`') + 1);
    return { source: lines.join('\n'), first, last };
}
const VERTEX_SHADER = extractShader('vertexShaderSource');
const FRAGMENT_SHADER = extractShader('fragmentShaderSource');

// Tab 6 only: the lines whose code is not in tab 5 (comments ignored).
// The code panel marks them "changed in tab 6".
const CHANGED_LINES = new Set();
if (TAB === 6) {
    const tab5Code = new Set(TAB5_SOURCE_LINES.map(codePart).filter(Boolean));
    SOURCE.forEach((text, i) => {
        const code = codePart(text);
        if (code && !tab5Code.has(code)) CHANGED_LINES.add(i + 1);
    });
}

// Turn a step's list of ranges into [first, last] line pairs. Each range
// is searched for after the start of the one before it. A range is one of
//   { from }               one line
//   { from, to }           from that line through the line with `to`
//   { from, lines: k }     k lines, starting at that line
//   { from, before }       up to (not including) the line with `before`
//   { from, toEnd: true }  to the end of the file
//   { block }              a line that opens "{", through its "}"
// `within` ('vs' or 'fs') limits the search to one shader.
function resolveRanges(specs, within) {
    const area = within === 'vs' ? VERTEX_SHADER : within === 'fs' ? FRAGMENT_SHADER : null;
    const lo = area ? area.first : 1;
    const hi = area ? area.last : SOURCE.length;
    let cursor = lo;
    const ranges = [];
    for (const spec of specs) {
        if (!spec) continue;
        const start = findLine(spec.block || spec.from, cursor, hi);
        if (!start) continue;
        let end = start;
        if (spec.block) end = blockEnd(start);
        else if (spec.to) end = findLine(spec.to, start, hi) || start;
        else if (spec.lines) end = start + spec.lines - 1;
        else if (spec.before) end = (findLine(spec.before, start + 1, hi) || start + 1) - 1;
        else if (spec.toEnd) end = SOURCE.length;
        while (end > start && isBlank(SOURCE[end - 1])) end--;
        ranges.push([start, end]);
        cursor = start + 1;
    }
    return ranges;
}


// ---------------------------------------------------------------------
// 2. THE STEPS
//    One object per step, in reading order. Fields:
//      id       stable name (used when switching tabs)
//      section  the file's section number (0-5)
//      only     6 if the step exists only in tab 6
//      title    string, or function(choice) for steps with a picker
//      picker   { choices: [rule numbers], start } : buttons that pick a rule
//      within   'vs' / 'fs': search the snippets only in that shader
//      ranges   function(choice) → list of ranges (see resolveRanges)
//      text     function(choice) → the explanation (HTML)
//      figure   function(choice) → the picture (HTML, usually one <svg>)
//      drawFigure  optional function(time, choice): redraws canvases in
//                  the figure every frame (the animated rules)
//      cube     function(choice) → how the live cube looks:
//                 { rule, ruleOdd, spin, overlay, blank, note }
// ---------------------------------------------------------------------
const tabText = (t5, t6) => (TAB === 6 ? t6 : t5);
const RULE_NAMES = [
    'Linear', 'Nearest vertex', 'Sharpened', 'Bands', 'Wireframe',
    'Ripple', 'Growing territory', 'Growing wireframe',
];
const ruleBlock = (k) => ({ block: 'if (' + RULE_VARIABLE + ' == ' + k + ') {' });
const POSE_TIME = 2.6;     // seconds: the angle the cube holds in paused steps

const ALL_STEPS = [
    // ---------------- 0. Context ----------------
    {
        id: 'context', section: 0,
        title: 'Get the WebGL 2 context',
        ranges: () => [{ from: "const canvas = document.getElementById('c');",
                         to: "const gl = canvas.getContext('webgl2');" }],
        text: () => `
            <p>Every WebGL command goes through one object, the <b>context</b>, here called <code>gl</code>.
            We get it from the <code>&lt;canvas&gt;</code> element on the page by asking for
            <code>'webgl2'</code>.</p>
            <p>Every later step calls a method of <code>gl</code>: <code>gl.createShader</code>,
            <code>gl.createBuffer</code>, <code>gl.drawArrays</code>, and so on.</p>
            <p>After these two lines nothing is drawn yet. The canvas stays empty until
            <code>draw()</code> runs (section 4).</p>`,
        figure: figContext,
        cube: () => ({ blank: true, spin: false,
            note: 'Nothing is drawn yet: the canvas is empty until draw() runs.' }),
    },

    // ---------------- 1. Shaders ----------------
    {
        id: 'vs-inputs', section: 1,
        title: 'Vertex shader: its inputs',
        within: 'vs',
        ranges: () => [{ from: 'const vertexShaderSource', to: 'uniform mat4 uProjection;' }],
        text: () => `
            <p>The shaders are programs for the GPU, written in GLSL and kept in a JavaScript string.
            The <b>vertex shader</b> runs once for every vertex: 36 times for each picture of the cube.</p>
            <p>Its <code>in</code> variables are <b>attributes</b>: read from the buffer, a different
            set for every vertex. This example gives each vertex six of them: its position, its normal,
            its barycentric coordinates <code>aBary</code>, and the colors of <i>all three</i> vertices
            of its triangle, <code>aColor0</code>, <code>aColor1</code>, <code>aColor2</code>.</p>
            <p><code>uniform</code> variables are different: one value shared by all 36 vertices,
            set from JavaScript. Here they are the three matrices that place the cube on the screen.</p>`,
        figure: figVertexInputs,
        cube: () => ({ rule: 0, spin: false, overlay: 'colors',
            note: 'The outlined triangle: every one of its 3 vertices carries the same three colors C0, C1, C2.' }),
    },
    {
        id: 'vs-outputs', section: 1,
        title: 'Vertex shader: smooth and flat outputs',
        within: 'vs',
        ranges: () => [{ from: 'out vec3 vNormal;', to: 'flat out vec3 vColor2;' }],
        text: () => `
            <p>The vertex shader hands values on to the fragment shader through <code>out</code>
            variables (varyings). In between, the <b>rasterizer</b> finds every fragment the triangle
            covers and gives each one its own copy.</p>
            <p>A plain <code>out</code>, like <code>vBary</code>, is <b>interpolated</b>: a fragment
            gets λ0·(value at vertex 0) + λ1·(value at vertex 1) + λ2·(value at vertex 2), where
            λ0, λ1, λ2 are the fragment's barycentric coordinates. The vertices send (1,0,0), (0,1,0)
            and (0,0,1), so the result is (λ0, λ1, λ2): <b>each fragment receives its own weights</b>.</p>
            <p>A <code>flat out</code> is <b>not</b> interpolated: every fragment gets one vertex's value
            unchanged. All three vertices send the same three colors, so the colors arrive exactly
            as they were.</p>`,
        figure: figOutputs,
        cube: () => ({ rule: 0, spin: false, overlay: 'bary',
            note: 'aBary at the 3 vertices of the outlined triangle. Inside the triangle, vBary is interpolated between them.' }),
    },
    {
        id: 'vs-main', section: 1,
        title: 'Vertex shader: main()',
        within: 'vs',
        ranges: () => [{ from: 'void main() {' }, { from: 'vNormal = normalize(', before: '`;' }],
        text: () => `
            <p><code>main()</code> runs once per vertex and fills in the outputs.</p>
            <p>The normal is turned by the cube's rotation, <code>mat3(uModel)</code>, so the lighting
            stays fixed to the faces as the cube spins.</p>
            <p><code>vBary</code> and the three colors are copied straight through. The interesting work
            happens later, in the rasterizer and the fragment shader.</p>
            <p>Last, <code>gl_Position</code>: the vertex's position times three matrices, read from right
            to left. <code>uModel</code> turns the cube, <code>uView</code> puts it in front of the camera,
            <code>uProjection</code> adds perspective. The result is in <b>clip space</b>.</p>
            ${tabText('', `<p class="tab6note">In tab 6, <code>main()</code> also starts with one more line,
            <code>vTriangle = gl_VertexID / 3;</code>. It is the next step.</p>`)}`,
        figure: figVertexMain,
        cube: () => ({ rule: 0, spin: true,
            note: 'Spinning: uModel changes every frame, so gl_Position and vNormal change with it.' }),
    },
    {
        id: 'vs-triangle', section: 1, only: 6,
        title: 'Which triangle? gl_VertexID / 3',
        within: 'vs',
        ranges: () => [{ from: 'flat out int vTriangle;' }, { from: 'void main() {' },
                       { from: 'vTriangle = gl_VertexID / 3;' }],
        text: () => `
            <p>Tab 6 sends one more value: the number of the triangle the vertex belongs to.</p>
            <p><code>gl_VertexID</code> is built in: the number of the vertex being processed. With
            <code>drawArrays</code> it counts 0, 1, 2, … 35 through the buffer. Every 3 vertices make one
            triangle, so <b>integer division</b> by 3 (it drops the remainder) gives the triangle number,
            0 to 11. For example 7 / 3 = 2.</p>
            <p>The output is <code>flat</code>: the three vertices of a triangle all compute the same
            number, and the fragments get it unchanged. (GLSL requires integer outputs to be
            <code>flat</code>.)</p>`,
        figure: figVertexIds,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: false, overlay: 'triangles',
            note: 'Triangle numbers on the faces you can see. The outlined triangle also shows its 3 vertex IDs.' }),
    },
    {
        id: 'fs-inputs', section: 1,
        title: 'Fragment shader: what a fragment receives',
        within: 'fs',
        ranges: () => (TAB === 6
            ? [{ from: 'const fragmentShaderSource', to: 'flat in vec3 vColor2;' },
               { from: 'uniform float uTime;', to: 'out vec4 fragColor;' }]
            : [{ from: 'const fragmentShaderSource', to: 'out vec4 fragColor;' }]),
        text: () => `
            <p>The <b>fragment shader</b> runs once for every fragment, a candidate pixel inside a
            triangle. It never sees the triangle's vertices. It only has its <code>in</code> variables,
            prepared by the rasterizer, and the uniforms.</p>
            <p><code>vBary</code> is different for every fragment: it holds that fragment's weights
            (λ0, λ1, λ2). <code>vColor0</code>, <code>vColor1</code>, <code>vColor2</code> are the same for
            every fragment of the triangle.</p>
            <p>${tabText('<code>uMode</code> (one value for the whole draw call) picks the rule, and ',
                         'Tab 6\'s two rule uniforms come later, in “Even or odd triangle picks the rule”. ')}<code>uTime</code> is the clock
            for the animated rules. <code>fragColor</code> is the output: the color this fragment writes.</p>`,
        figure: figFragmentInputs,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: false, overlay: 'colors',
            note: 'Every fragment of the outlined triangle gets the same C0, C1, C2, and its own vBary.' }),
    },
    {
        id: 'rule0', section: 1,
        title: 'interpolate(), rule 0: linear',
        within: 'fs',
        ranges: () => [{ from: 'vec3 interpolate(' }, ruleBlock(0),
                       { from: 'return vec3(1.0, 0.0, 1.0);', lines: 2 }],
        text: () => `
            <p><code>interpolate()</code> turns the ingredients into one color. <code>b</code> holds the
            weights (<code>b.x</code> = λ0, <code>b.y</code> = λ1, <code>b.z</code> = λ2), and
            <code>c0</code>, <code>c1</code>, <code>c2</code> are the three vertex colors.
            ${tabText('', 'In tab 6 its first argument, <code>mode</code>, says which rule to use.')}</p>
            <p>Rule 0 is <b>linear interpolation</b>: the weighted sum λ0·C0 + λ1·C1 + λ2·C2. The weights
            are between 0 and 1 and add up to 1, so near a vertex its color counts most.</p>
            <p>This is exactly what the rasterizer does by itself for an ordinary varying, so rule 0 looks
            like tab 4. If ${tabText('<code>uMode</code>', '<code>mode</code>')} matches no rule, the
            function returns bright pink, so a missing case is easy to spot.</p>`,
        figure: figRule0,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: true, note: 'Rule 0 on every triangle.' }),
    },
    {
        id: 'rules1-4', section: 1,
        picker: { choices: [1, 2, 3, 4], start: 1 },
        title: (k) => 'interpolate(), rules 1–4: ' + RULE_NAMES[k].toLowerCase(),
        within: 'fs',
        ranges: (k) => [{ from: 'vec3 interpolate(' }, ruleBlock(k)],
        text: (k) => `<p>Pick a rule. Each one is a different way to turn the weights and the three
            colors into one color. Only its <code>if</code> block is shown.</p>` + RULE_TEXT[k],
        figure: figStaticRule,
        cube: (k) => ({ rule: k, ruleOdd: k, spin: true, note: `Rule ${k} (${RULE_NAMES[k].toLowerCase()}) on every triangle.` }),
    },
    {
        id: 'rules5-7', section: 1,
        picker: { choices: [5, 6, 7], start: 5 },
        title: (k) => 'interpolate(), rules 5–7 (animated): ' + RULE_NAMES[k].toLowerCase(),
        within: 'fs',
        ranges: (k) => [{ from: 'vec3 interpolate(' }, ruleBlock(k)],
        text: (k) => `<p>These rules also use <code>uTime</code>, the seconds since the page loaded.
            It is the same for every fragment and changes only from one frame to the next, so the whole
            pattern moves together.</p>` + RULE_TEXT[k],
        figure: figAnimatedRule,
        drawFigure: drawAnimatedRule,
        cube: (k) => ({ rule: k, ruleOdd: k, spin: true, note: `Rule ${k} (${RULE_NAMES[k].toLowerCase()}) on every triangle.` }),
    },
    {
        id: 'fs-even-odd', section: 1, only: 6,
        title: 'Even or odd triangle picks the rule',
        within: 'fs',
        ranges: () => [{ from: 'flat in int vTriangle;' },
                       { from: 'uniform int uModeEven;', to: 'uniform int uModeOdd;' },
                       { from: 'vec3 interpolate(' },
                       { from: 'void main() {' },
                       { from: 'int mode = (vTriangle % 2 == 0)', to: 'vec3 color = interpolate(' }],
        text: () => `
            <p>Tab 6 has two rule uniforms, <code>uModeEven</code> and <code>uModeOdd</code>, and the
            triangle number <code>vTriangle</code> from the vertex shader.</p>
            <p><code>main()</code> picks the rule first. <code>vTriangle % 2</code> is the remainder after
            dividing by 2: 0 for even triangles, 1 for odd ones. (<code>condition ? a : b</code> means
            “a if the condition is true, otherwise b”.)</p>
            <p>Then it passes that <code>mode</code> to <code>interpolate()</code>, which now takes the rule as
            its first argument instead of reading a uniform. Each face is two triangles in a row in the
            buffer, so every face gets one even and one odd triangle.</p>`,
        figure: figEvenOdd,
        cube: () => ({ rule: 1, ruleOdd: 4, spin: false, overlay: 'evenOdd',
            note: 'Even triangles (solid outline): rule 1, nearest vertex. Odd triangles (dashed): rule 4, wireframe.' }),
    },
    {
        id: 'fs-main', section: 1,
        title: 'Fragment shader: main(), color and lighting',
        within: 'fs',
        ranges: () => [{ block: 'void main() {' }],
        text: () => `
            <p><code>main()</code> runs once per fragment. First it calls <code>interpolate()</code> for
            the color.${tabText('', ' (In tab 6 it picks the rule just before that.)')}</p>
            <p>Then it lights it. <code>dot(vNormal, lightDirection)</code> measures how closely the face
            points toward the light: 1 straight at it, 0 sideways, negative away from it, and
            <code>max()</code> turns negative values into 0.</p>
            <p>30% <b>ambient</b> light keeps faces in shadow from going black:
            light = 0.3 + 0.7·brightness. The color times the light, with alpha 1.0 (opaque), goes into
            <code>fragColor</code>.</p>`,
        figure: figLighting,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: true, note: 'Watch a face get brighter as it turns toward the light (above, slightly to the right).' }),
    },
    {
        id: 'compile', section: 1,
        title: 'Compile the shaders, link the program',
        ranges: () => [{ from: 'function compileShader', to: 'gl.useProgram(program);' }],
        text: () => `
            <p>So far the shaders are only strings. <code>compileShader()</code> hands one to the GPU's
            driver and compiles it. If the GLSL has an error, the message is thrown, so it shows up in the
            browser's console.</p>
            <p>A <b>program</b> is a vertex shader and a fragment shader <b>linked</b> together. Linking
            checks that every <code>in</code> of the fragment shader matches an <code>out</code> of the
            vertex shader (same name, same type, <code>flat</code> on both sides).</p>
            <p><code>useProgram</code> makes it the program that the next draw calls run.</p>`,
        figure: figCompile,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: false,
            note: 'This cube runs the same two shader strings you see in the code, compiled by this page.' }),
    },

    // ---------------- 2. Cube geometry → buffer ----------------
    {
        id: 'cube-data', section: 2,
        title: 'Corner colors and cubeVertices',
        ranges: () => [{ from: 'const BLACK', to: 'const WHITE' },
                       { from: 'const cubeVertices = new Float32Array([', lines: 8 },
                       { from: ']);' }, { from: 'const VERTEX_COUNT = 36;' }],
        text: () => `
            <p>Every cube corner has one color: the color is the corner's position plus 0.5, so
            x controls red, y green and z blue. Black is at (−,−,−), white at (+,+,+).</p>
            <p>The cube is written as 36 vertices (6 faces × 2 triangles × 3 vertices), 9 numbers each:
            position, normal, color. Only the front face is shown here; the other five follow the
            same pattern.</p>
            <p>The front face's two triangles share the BLUE and WHITE corners. The edge between them is
            the face's diagonal.</p>`,
        figure: figCubeCorners,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: false, overlay: 'corners',
            note: 'The color of each corner you can see.' }),
    },
    {
        id: 'rebuild', section: 2,
        title: 'Rebuild the data: 9 → 18 floats per vertex',
        ranges: () => [{ from: 'const FLOATS_PER_INPUT_VERTEX', to: 'const vertexData = new Float32Array' }],
        text: () => `
            <p>The shaders need more per vertex: <code>aBary</code> and all three colors of its triangle.
            Both depend on the <i>triangle</i>, not just the vertex, so the loop walks through the cube
            one triangle at a time (<code>first</code> = 0, 3, 6, …).</p>
            <p>For each triangle it reads the three colors, then writes its three vertices: position and
            normal as before, <code>BARY_COORDS[i]</code> for the i-th vertex, then color0, color1,
            color2. The result is 36 vertices × 18 floats.</p>
            <p>A cube corner can be vertex 0 of one triangle and vertex 2 of the next, so it needs a
            different <code>aBary</code> in each. That is why the triangles don't share vertices.</p>`,
        figure: figRebuild,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: false, overlay: 'bary',
            note: 'The outlined triangle\'s three aBary values: one per vertex, set by BARY_COORDS.' }),
    },
    {
        id: 'upload', section: 2,
        title: 'Copy the data to the GPU',
        ranges: () => [{ from: 'const buffer = gl.createBuffer();', to: 'gl.bufferData(' }],
        text: () => `
            <p><code>vertexData</code> is still a JavaScript array in the computer's main memory. The GPU
            can't read it there.</p>
            <p><code>createBuffer</code> makes an empty buffer on the GPU. <code>bindBuffer</code> makes it
            the current <code>ARRAY_BUFFER</code> (vertex data): the next buffer commands act on whichever
            buffer is bound. <code>bufferData</code> copies the 648 floats (2592 bytes) into it.</p>
            <p><code>STATIC_DRAW</code> is a hint: we fill it once and draw from it many times.</p>`,
        figure: figUpload,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: false,
            note: 'Every frame draws from the same buffer. It was filled once, when the page loaded.' }),
    },
    {
        id: 'attributes', section: 2,
        title: 'connectAttribute: stride and offsets',
        ranges: () => [{ from: 'const BYTES_PER_FLOAT', to: 'const stride' },
                       { block: 'function connectAttribute' },
                       { from: "connectAttribute('aPosition'", to: "connectAttribute('aColor2'" }],
        text: () => `
            <p>To WebGL the buffer is just bytes. For each attribute, <code>vertexAttribPointer</code> says
            how to read them: 3 floats, the <b>stride</b> (72 bytes from one vertex to the next), and the
            <b>offset</b> (where in a vertex this attribute starts).</p>
            <p>All six attributes are 3 floats and sit one after another, so attribute i starts at
            3·i floats = 12·i bytes. That is why the calls pass 0, 3, 6, 9, 12, 15.</p>
            <p><code>getAttribLocation</code> asks the linked program for the attribute's slot, and
            <code>enableVertexAttribArray</code> says “fill this slot from a buffer”.</p>`,
        figure: figStride,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: false,
            note: 'For vertex v, the GPU reads aBary at byte 24 + 72·v of the buffer.' }),
    },
    {
        id: 'uniforms', section: 2,
        title: 'Find the uniforms' + tabText(' and the menu', ' and the two menus'),
        ranges: () => (TAB === 6
            ? [{ from: 'const uModel = gl.getUniformLocation', to: 'const uTime =' },
               { from: 'const evenMenu', to: 'const oddMenu' }]
            : [{ from: 'const uModel = gl.getUniformLocation', to: 'const uTime =' },
               { from: 'const modeMenu' }]),
        text: () => `
            <p>Uniforms don't come from the buffer. JavaScript sets them before each draw call.</p>
            <p><code>getUniformLocation</code> looks up where each uniform lives in the linked program.
            These variables hold that <b>location</b>, not a value; the values are sent later,
            in <code>draw()</code>.</p>
            <p>${tabText('The menu on the page supplies the rule number for <code>uMode</code>.',
                'The two menus on the page supply the rule numbers for <code>uModeEven</code> and <code>uModeOdd</code>.')}</p>`,
        figure: figUniforms,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: false, note: 'The readout below shows this frame\'s uniform values.' }),
    },

    // ---------------- 3. Matrix helpers ----------------
    {
        id: 'rotations', section: 3,
        title: 'rotationX, rotationY, multiply',
        ranges: () => [{ block: 'function rotationX' }, { block: 'function rotationY' }, { block: 'function multiply' }],
        text: () => `
            <p>A 4×4 matrix is stored as 16 numbers in <b>column-major</b> order: the first 4 are the first
            column. Each row of numbers in these array literals is one column of the matrix.</p>
            <p>The columns say where the axes go. In <code>rotationY(θ)</code>, column 0 is where the x axis
            ends up, (cos θ, 0, −sin θ), and column 2 is where the z axis ends up, (sin θ, 0, cos θ). The
            y axis stays put: the cube spins like a top. <code>rotationX</code> tips it forward instead.</p>
            <p><code>multiply(a, b)</code> gives the matrix that does <code>b</code> first, then
            <code>a</code>.</p>`,
        figure: figRotation,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: true, note: 'Turned by rotationY(angle) · rotationX(0.7·angle).' }),
    },
    {
        id: 'camera', section: 3,
        title: 'perspective and lookAt',
        ranges: () => [{ block: 'function perspective' }, { block: 'function lookAt' }],
        text: () => `
            <p><code>lookAt(eye, target, up)</code> builds the <b>view matrix</b>. It finds the camera's
            own three axes with cross products, then moves and turns the world so the camera sits at the
            origin, looking down −z.</p>
            <p><code>perspective</code> builds the <b>projection matrix</b>: a 45° vertical field of view,
            the canvas's aspect ratio, and near and far planes 0.1 and 100 units from the camera. It makes
            far things look smaller.</p>
            <p>The <a href="../webgl-camera-playground/">WebGL Camera Playground</a> lets you change every
            one of these numbers.</p>`,
        figure: figCamera,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: true, note: 'Seen from eye = (0, 0, 3), looking at (0, 0, 0).' }),
    },

    // ---------------- 4. Draw ----------------
    {
        id: 'draw-setup', section: 4,
        title: 'draw(): clear, then set the uniforms',
        ranges: () => [{ from: 'function draw(angle, seconds) {', to: 'gl.uniform1f(uTime, seconds);' }],
        text: () => `
            <p><code>draw()</code> makes one picture. Everything before it was setup and ran once.</p>
            <p>a. Match the canvas's pixel count to its size on the page, and set the viewport.
            b. Clear to dark gray, and clear the <b>depth buffer</b>. With <code>DEPTH_TEST</code> on,
            nearer fragments hide farther ones.</p>
            <p>c. Send the camera: projection and view matrices. d. Send the cube's rotation (tip by
            0.7·angle, then spin by angle), ${tabText('the rule from the menu', 'the two rules from the menus')},
            and the time.</p>`,
        figure: figDrawSetup,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: true, note: 'The readout shows what draw() sends this frame.' }),
    },
    {
        id: 'draw-call', section: 4,
        title: 'drawArrays(TRIANGLES, 0, 36)',
        ranges: () => [{ from: 'gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);', lines: 2 }],
        text: () => `
            <p>One call draws the whole cube: read 36 vertices from the buffer, starting at vertex 0, and
            treat every 3 as a triangle.</p>
            <p>For this call the GPU runs the vertex shader 36 times. It rasterizes the 12 triangles into
            fragments, interpolating <code>vBary</code> and <code>vNormal</code> and passing the flat
            values on unchanged. It runs the fragment shader once per fragment, and the depth test keeps
            only the nearest fragment at each pixel.</p>`,
        figure: figPipeline,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: false, overlay: 'outlines',
            note: 'The triangles facing you. The 6 facing away are drawn too, then hidden by the depth test.' }),
    },

    // ---------------- 5. Animate ----------------
    {
        id: 'animate', section: 5,
        title: 'animate() and requestAnimationFrame',
        ranges: () => [{ from: 'const SPIN_SPEED', toEnd: true }],
        text: () => `
            <p><code>requestAnimationFrame(animate)</code> asks the browser to call <code>animate</code>
            just before it next updates the screen, usually 60 times a second. <code>animate</code> draws,
            then asks again, so it runs in a loop.</p>
            <p>The angle comes from the <b>elapsed time</b> (seconds × 0.3), not from counting frames. A fast
            computer draws more frames than a slow one, but the cube turns at the same speed on both.</p>
            <p>The same seconds become <code>uTime</code>.</p>`,
        figure: figAnimate,
        cube: () => ({ rule: 0, ruleOdd: 0, spin: true, note: 'angle = seconds × 0.3. A full turn takes about 21 s.' }),
    },
];
const STEPS = ALL_STEPS.filter((s) => !s.only || s.only === TAB);

// What each rule does, for the rule steps.
const RULE_TEXT = {
    1: `<p><b>Nearest vertex</b>: no mixing. Return the color of the vertex with the largest weight,
        the closest vertex. Each triangle splits into three regions of one color. The borders (dashed) are
        where two weights are equal; they meet at the triangle's centroid.</p>`,
    2: `<p><b>Sharpened</b>: raise each weight to the 4th power, then divide by their sum so they add up to
        1 again. Large weights stay large and small ones shrink toward 0, so each color stays pure near
        its vertex and the change is squeezed toward the middle.</p>`,
    3: `<p><b>Bands</b>: round each weight down to a multiple of 1/4, then rescale. The color changes in steps
        instead of smoothly. Each band border is a line where one weight is constant, parallel to the
        edge opposite that vertex.</p>`,
    4: `<p><b>Wireframe</b>: linear, but fragments close to an edge are almost black. On an edge, the weight
        of the opposite vertex is 0, so the smallest weight tells how close the fragment is to the nearest
        edge. Below 0.02 counts as “on an edge”.</p>`,
    5: `<p><b>Ripple</b>: two rules inside one triangle. The smallest weight (0 on the edges, 1/3 at the
        centroid) goes into a sine wave. Where the wave is positive the fragment uses rule 0, elsewhere
        rule 1. Subtracting <code>uTime</code> moves the bands, nested triangles, inward over time.</p>`,
    6: `<p><b>Growing territory</b>: nearest vertex, but one vertex at a time claims more. Vertex k owns
        every fragment with λk ≥ 1 − T. As T goes from 0.5 to 1 and back over 3 seconds, the border, a line
        parallel to the opposite edge, sweeps across the triangle and back. Then the next vertex has its turn.</p>`,
    7: `<p><b>Growing wireframe</b>: rule 4 with a moving threshold. Over 4 seconds the threshold goes from
        0.02 up to 1/3 and back, so the black edges grow inward until they meet at the centroid,
        then shrink back.</p>`,
};


// ---------------------------------------------------------------------
// 3. PICTURE HELPERS
//    Most pictures are inline SVG built from a few small helpers. The
//    pictures of colored triangles are drawn pixel by pixel with a
//    JavaScript copy of interpolate() (interpolateColor below), the same
//    math the fragment shader does, and put into the SVG as an image.
// ---------------------------------------------------------------------
const COL = {
    pos: '#569cd6', normal: '#4ec9b0', bary: '#e2c541', color: '#c586c0',
    uniform: '#ce9178', text: '#ddd', dim: '#8a8a8a', line: '#9a9a9a', box: '#2a2a2e',
};
const css = (rgb) => `rgb(${rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)).join(',')})`;
const f2 = (x) => x.toFixed(2);
const fmt = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : String(+x.toFixed(2)));
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inkOn = (rgb) => (0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2] > 0.5 ? '#000' : '#fff');
const swatch = (rgb) => `<span class="swatch" style="background:${css(rgb)}"></span>`;

function svg(w, h, body) {
    return `<svg viewBox="0 0 ${w} ${h}" font-family="system-ui, sans-serif" font-size="12" fill="${COL.text}">
        <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7"
            orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${COL.line}"/></marker></defs>
        ${body}</svg>`;
}
function rect(x, y, w, h, { fill = COL.box, stroke = '#666', rx = 4, dash = false } = {}) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"
        ${dash ? 'stroke-dasharray="5 3"' : ''}/>`;
}
function txt(x, y, s, { size = 12, fill = COL.text, anchor = 'middle', weight = 'normal', mono = false } = {}) {
    const family = mono ? ' font-family="ui-monospace, Menlo, Consolas, monospace"' : '';
    return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}"
        font-weight="${weight}" dominant-baseline="middle" style="white-space:pre"${family}>${s}</text>`;
}
function arrow(x1, y1, x2, y2, { color = COL.line, dash = false, width = 1.5 } = {}) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"
        marker-end="url(#arr)" ${dash ? 'stroke-dasharray="4 3"' : ''}/>`;
}
function line(x1, y1, x2, y2, { color = COL.line, dash = false, width = 1.2 } = {}) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"
        ${dash ? 'stroke-dasharray="4 3"' : ''}/>`;
}
// A box with one or more centered lines of text.
function boxText(x, y, w, h, lines, { stroke = '#666', fill = COL.box, mono = false, size = 12, color = COL.text } = {}) {
    const list = Array.isArray(lines) ? lines : [lines];
    const lh = size + 4;
    const top = y + h / 2 - (list.length - 1) * lh / 2;
    return rect(x, y, w, h, { stroke, fill }) +
        list.map((s, i) => txt(x + w / 2, top + i * lh, s, { mono, size, fill: color })).join('');
}
function swatchRect(x, y, w, h, rgb) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${css(rgb)}" stroke="#888"/>`;
}

// ---- A JavaScript copy of interpolate() (same rules, same constants) ----
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const fract = (x) => x - Math.floor(x);
const glslMod = (x, y) => x - y * Math.floor(x / y);
const mix = (a, b, t) => a + (b - a) * t;
const weighted = (w, c) => add3(add3(scale3(c[0], w[0]), scale3(c[1], w[1])), scale3(c[2], w[2]));
function nearest(b, c) {
    if (b[0] >= b[1] && b[0] >= b[2]) return c[0];
    if (b[1] >= b[2]) return c[1];
    return c[2];
}
// The values the animated rules compute from the time (also shown in the picture).
function rule6Turn(time) {
    const turns = time / 3.0;
    const k = Math.trunc(glslMod(Math.floor(turns), 3.0));
    const T = 0.5 + 0.5 * (1 - Math.abs(2 * fract(turns) - 1));
    return { k, T };
}
const rule7Threshold = (time) => mix(0.02, 1 / 3, 1 - Math.abs(2 * fract(time / 4.0) - 1));

function interpolateColor(mode, b, c, time) {
    if (mode === 0) return weighted(b, c);
    if (mode === 1) return nearest(b, c);
    if (mode === 2 || mode === 3) {
        let w = (mode === 2) ? b.map((x) => Math.pow(Math.max(x, 0), 4)) : b.map((x) => Math.floor(x * 4) / 4);
        w = scale3(w, 1 / (w[0] + w[1] + w[2]));
        return weighted(w, c);
    }
    if (mode === 4 || mode === 7) {
        const threshold = (mode === 4) ? 0.02 : rule7Threshold(time);
        return Math.min(b[0], b[1], b[2]) < threshold ? [0.05, 0.05, 0.05] : weighted(b, c);
    }
    if (mode === 5) {
        const d = Math.min(b[0], b[1], b[2]);
        const wave = Math.sin(6.2832 * (4.0 * d * 3.0 - time / 1.5));
        return wave > 0 ? weighted(b, c) : nearest(b, c);
    }
    if (mode === 6) {
        const { k, T } = rule6Turn(time);
        return b[k] >= 1 - T ? c[k] : nearest(b, c);
    }
    return [1, 0, 1];
}

// 2D barycentric coordinates of p in triangle pts, or null if outside.
function bary2D(p, [a, b, c]) {
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    const s0 = ((b[0] - p[0]) * (c[1] - p[1]) - (c[0] - p[0]) * (b[1] - p[1])) / area;
    const s1 = ((c[0] - p[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (c[1] - p[1])) / area;
    const s2 = 1 - s0 - s1;
    const e = -1e-9;
    return (s0 < e || s1 < e || s2 < e) ? null : [s0, s1, s2];
}
const pointAt = (pts, b) => [0, 1].map((i) => b[0] * pts[0][i] + b[1] * pts[1][i] + b[2] * pts[2][i]);

// Color every pixel of a w × h canvas that lies in one of the triangles
// ({ pts: [[x,y] × 3], colors: [c0, c1, c2], mode }) with that triangle's rule.
function paintTriangles(cv, w, h, tris, time) {
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d');
    const img = g.createImageData(cv.width, cv.height);
    for (let py = 0; py < cv.height; py++) {
        for (let px = 0; px < cv.width; px++) {
            const p = [(px + 0.5) / dpr, (py + 0.5) / dpr];
            for (const t of tris) {
                const b = bary2D(p, t.pts);
                if (!b) continue;
                const rgb = interpolateColor(t.mode, b, t.colors, time);
                const i = 4 * (py * cv.width + px);
                img.data[i] = rgb[0] * 255;
                img.data[i + 1] = rgb[1] * 255;
                img.data[i + 2] = rgb[2] * 255;
                img.data[i + 3] = 255;
                break;
            }
        }
    }
    g.putImageData(img, 0, 0);
    return cv;
}
// The same, as an <image> to put inside an SVG at (x, y).
function triangleImage(x, y, w, h, tris, time = 0) {
    const url = paintTriangles(document.createElement('canvas'), w, h, tris, time).toDataURL();
    return `<image href="${url}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
}

// The triangle most pictures use: triangle 0 of the front face
// (BLUE, MAGENTA, WHITE), drawn head-on. Points are local to its image.
const TRI_W = 230, TRI_H = 200;
const TRI_PTS = [[18, 185], [212, 185], [115, 15]];
const TRI_COLORS = () => [Array.from(colorOf(0)), Array.from(colorOf(1)), Array.from(colorOf(2))];
const EXAMPLE_B = [0.5, 0.3, 0.2];            // the example fragment's weights

// The triangle at (ox, oy) with rule `mode`, its corners labeled.
function labeledTriangle(ox, oy, mode, { labels = true, time = 0, point = null } = {}) {
    const c = TRI_COLORS();
    let s = triangleImage(ox, oy, TRI_W, TRI_H, [{ pts: TRI_PTS, colors: c, mode }], time);
    s += `<polygon points="${TRI_PTS.map((p) => (ox + p[0]) + ',' + (oy + p[1])).join(' ')}" fill="none" stroke="#bbb"/>`;
    if (labels) {
        const where = [[-4, 12, 'start'], [4, 12, 'end'], [0, -9, 'middle']];
        TRI_PTS.forEach((p, i) => {
            const [dx, dy, anchor] = where[i];
            s += txt(ox + p[0] + dx, oy + p[1] + dy, `C${i} ${colorName(c[i])}`, { size: 11, anchor, fill: '#ccc' });
        });
    }
    if (point) {
        const [x, y] = pointAt(TRI_PTS, point);
        s += `<circle cx="${ox + x}" cy="${oy + y}" r="5" fill="none" stroke="#000" stroke-width="3"/>
              <circle cx="${ox + x}" cy="${oy + y}" r="5" fill="none" stroke="#fff" stroke-width="1.5"/>`;
    }
    return s;
}

// ---- One function per picture ----

function figContext() {
    const methods = ['gl.createShader(…)', 'gl.createBuffer(…)', 'gl.vertexAttribPointer(…)', 'gl.drawArrays(…)'];
    return svg(520, 150,
        boxText(6, 45, 108, 56, ['&lt;canvas id="c"&gt;', 'on the page'], { mono: true, size: 10.5 }) +
        arrow(116, 73, 250, 73) +
        txt(183, 60, "getContext('webgl2')", { mono: true, size: 10 }) +
        rect(252, 14, 262, 120, { stroke: COL.pos }) +
        txt(383, 34, 'gl: the WebGL 2 context', { weight: 'bold' }) +
        methods.map((m, i) => txt(270, 58 + i * 19, m, { mono: true, size: 11.5, anchor: 'start', fill: '#bbb' })).join(''));
}

// The 18 floats of vertex 0, grouped by attribute.
const ATTRS = [
    { name: 'aPosition', color: COL.pos }, { name: 'aNormal', color: COL.normal },
    { name: 'aBary', color: COL.bary }, { name: 'aColor0', color: COL.color },
    { name: 'aColor1', color: COL.color }, { name: 'aColor2', color: COL.color },
];
function vertexRecord(x, y, cell, v, { showNames = true, size = 9 } = {}) {
    const values = Array.from(vertexData.slice(v * FLOATS_PER_VERTEX, (v + 1) * FLOATS_PER_VERTEX));
    let s = '';
    ATTRS.forEach((a, g) => {
        const gx = x + g * 3 * cell;
        if (g >= 3) {
            s += swatchRect(gx + 1, y, 3 * cell - 2, 22, values.slice(3 * g, 3 * g + 3));
        } else {
            for (let k = 0; k < 3; k++) {
                s += rect(gx + k * cell, y, cell, 22, { stroke: a.color, rx: 1 });
                s += txt(gx + k * cell + cell / 2, y + 11, fmt(values[3 * g + k]), { mono: true, size });
            }
        }
        if (showNames) s += txt(gx + 1.5 * cell, y + 34, a.name, { size: 11, fill: a.color, mono: true });
    });
    return s;
}

function figVertexInputs() {
    return svg(520, 230,
        txt(26, 14, 'One vertex in the buffer (vertex 0, the 1st vertex of triangle 0): 18 floats', { anchor: 'start', size: 11.5, fill: '#bbb' }) +
        vertexRecord(26, 26, 26, 0) +
        [0, 1, 2, 3, 4, 5].map((g) => arrow(26 + g * 78 + 39, 70, 26 + g * 78 + 39, 118)).join('') +
        txt(200, 94, 'in (attributes): a new set for every vertex', { size: 11, fill: '#bbb' }) +
        boxText(26, 120, 468, 40, 'vertex shader: runs once per vertex, 36 times per picture', { stroke: COL.pos }) +
        boxText(150, 184, 220, 38, ['uniform uModel, uView, uProjection', 'from JavaScript, same for all 36'], { stroke: COL.uniform, size: 11 }) +
        arrow(260, 184, 260, 162, { color: COL.uniform }));
}

function figOutputs() {
    const c = TRI_COLORS();
    const ox = 10, oy = 20;
    const P = pointAt(TRI_PTS, EXAMPLE_B);
    let s = labeledTriangle(ox, oy, 0, { labels: false, point: EXAMPLE_B });
    const tags = ['(1,0,0)', '(0,1,0)', '(0,0,1)'];
    const where = [[-2, 14, 'start'], [2, 14, 'end'], [0, -10, 'middle']];
    TRI_PTS.forEach((p, i) => {
        s += txt(ox + p[0] + where[i][0], oy + p[1] + where[i][1], 'vBary ' + tags[i], { size: 11, anchor: where[i][2], fill: COL.bary, mono: true });
    });
    s += txt(ox + P[0] + 10, oy + P[1] - 14, '(0.5, 0.3, 0.2)', { size: 11, anchor: 'start', fill: '#fff', mono: true });
    // Right: the flat colors.
    const x0 = 268;
    s += txt(x0, 22, 'vColor0, vColor1, vColor2 (flat)', { anchor: 'start', weight: 'bold', fill: COL.color });
    const rows = ['vertex 0 sends', 'vertex 1 sends', 'vertex 2 sends', 'every fragment gets'];
    rows.forEach((r, i) => {
        const y = 48 + i * 30 + (i === 3 ? 10 : 0);
        s += txt(x0, y + 9, r, { anchor: 'start', size: 11.5 });
        c.forEach((rgb, k) => { s += swatchRect(x0 + 130 + k * 26, y, 20, 18, rgb); });
    });
    s += line(x0, 140, x0 + 210, 140, { color: '#555' });
    s += txt(x0, 196, 'vBary (smooth): at the circled fragment', { anchor: 'start', weight: 'bold', fill: COL.bary, size: 11.5 });
    s += txt(x0, 214, '0.5·(1,0,0) + 0.3·(0,1,0) + 0.2·(0,0,1)', { anchor: 'start', mono: true, size: 10.5 });
    s += txt(x0, 230, '= (0.5, 0.3, 0.2): its own weights', { anchor: 'start', mono: true, size: 10.5 });
    return svg(520, 240, s);
}

function figVertexMain() {
    const spaces = [['aPosition', 'model space'], ['world', 'space'], ['view', '(camera) space'], ['gl_Position', 'clip space']];
    const mats = ['uModel', 'uView', 'uProjection'];
    let s = txt(260, 14, 'gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0)', { mono: true, size: 11 });
    s += txt(260, 32, 'read right to left: uModel acts first', { size: 11, fill: COL.dim });
    spaces.forEach((lines, i) => { s += boxText(4 + i * 132, 50, 100, 44, lines, { stroke: i === 0 || i === 3 ? COL.pos : '#666', size: 11 }); });
    mats.forEach((m, i) => {
        const x = 104 + i * 132;
        s += arrow(x + 2, 72, x + 30, 72);
        s += txt(x + 16, 104, m, { mono: true, size: 10.5, fill: COL.uniform });
    });
    s += boxText(4, 124, 100, 34, 'aNormal', { stroke: COL.normal, mono: true, size: 11 });
    s += arrow(106, 141, 236, 141);
    s += txt(171, 130, 'mat3(uModel)', { mono: true, size: 10.5, fill: COL.uniform });
    s += boxText(238, 124, 160, 34, ['vNormal: turned', 'with the cube'], { stroke: COL.normal, size: 11 });
    s += boxText(4, 172, 100, 34, ['aBary,', 'aColor0–2'], { stroke: COL.bary, size: 11 });
    s += arrow(106, 189, 236, 189);
    s += txt(171, 178, 'copied as is', { size: 10.5, fill: COL.dim });
    s += boxText(238, 172, 160, 34, ['vBary,', 'vColor0–2'], { stroke: COL.bary, size: 11 });
    return svg(520, 214, s);
}

function figVertexIds() {
    const cell = 26, x0 = 26;
    let s = txt(260, 12, 'gl_VertexID (drawArrays counts through the buffer) → vTriangle = gl_VertexID / 3', { size: 11.5 });
    for (let row = 0; row < 2; row++) {
        const y = 48 + row * 96;
        for (let i = 0; i < 18; i++) {
            const id = row * 18 + i;
            const t = Math.floor(id / 3);
            s += rect(x0 + i * cell, y, cell, 22, { stroke: t % 2 ? '#ffd54a' : '#fff', rx: 1, dash: t % 2 === 1 });
            s += txt(x0 + i * cell + cell / 2, y + 11, String(id), { mono: true, size: 10.5 });
        }
        for (let g = 0; g < 6; g++) {
            const t = row * 6 + g;
            const gx = x0 + g * 3 * cell;
            s += `<path d="M${gx + 3},${y + 28} v5 h${3 * cell - 6} v-5" fill="none" stroke="#888"/>`;
            s += txt(gx + 1.5 * cell, y + 44, 'triangle ' + t, { size: 10.5, fill: t % 2 ? '#ffd54a' : '#fff' });
        }
        for (let f = 0; f < 3; f++) {
            const face = FACE_NAMES[row * 3 + f];
            s += txt(x0 + f * 6 * cell + 3 * cell, y - 12, face + ' face', { size: 11, fill: COL.dim });
        }
    }
    s += txt(260, 220, 'Example: vertex 7 → 7 / 3 = 2 (remainder dropped) → triangle 2', { size: 11.5, mono: true });
    return svg(520, 232, s);
}

function figFragmentInputs() {
    // A small pixel grid with the triangle on it; fragments = covered pixel centers.
    const cell = 18, cols = 13, rows = 11, gx = 8, gy = 10;
    const pts = [[1.2, 10.4], [12.2, 9.6], [6.4, 0.6]].map(([x, y]) => [x * cell, y * cell]);
    const c = TRI_COLORS();
    let s = '';
    for (let i = 0; i <= cols; i++) s += line(gx + i * cell, gy, gx + i * cell, gy + rows * cell, { color: '#333', width: 1 });
    for (let j = 0; j <= rows; j++) s += line(gx, gy + j * cell, gx + cols * cell, gy + j * cell, { color: '#333', width: 1 });
    s += `<polygon points="${pts.map((p) => (gx + p[0]) + ',' + (gy + p[1])).join(' ')}" fill="none" stroke="#bbb"/>`;
    const pick = [5, 6];             // the highlighted fragment's pixel (column, row)
    let pickB = null;
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            const p = [(i + 0.5) * cell, (j + 0.5) * cell];
            const b = bary2D(p, pts);
            if (!b) continue;
            const isPick = i === pick[0] && j === pick[1];
            if (isPick) pickB = b;
            s += `<rect x="${gx + i * cell + 2}" y="${gy + j * cell + 2}" width="${cell - 4}" height="${cell - 4}"
                fill="${css(weighted(b, c))}" opacity="${isPick ? 1 : 0.8}" ${isPick ? 'stroke="#fff" stroke-width="2"' : ''}/>`;
        }
    }
    const px = gx + (pick[0] + 1) * cell, py = gy + (pick[1] + 0.5) * cell;
    const x0 = 268;
    s += line(px, py, x0 - 6, 40, { color: '#fff' });
    const rowsText = [
        [`vBary = (${pickB.map(f2).join(', ')})`, 'different for every fragment', COL.bary],
        ['vColor0, vColor1, vColor2', 'the same for the whole triangle', COL.color],
        ['vNormal', 'interpolated (equal on a flat face)', COL.normal],
        [tabText('uMode, uTime', 'uTime'), 'the same for the whole draw call', COL.uniform],
        ['out fragColor', 'what this fragment writes', '#fff'],
    ];
    s += txt(x0, 22, 'This fragment receives:', { anchor: 'start', weight: 'bold' });
    rowsText.forEach(([code, note, color], i) => {
        const y = 46 + i * 36;
        s += txt(x0, y, code, { anchor: 'start', mono: true, size: 11, fill: color });
        s += txt(x0, y + 15, note, { anchor: 'start', size: 10.5, fill: COL.dim });
        if (i === 1) c.forEach((rgb, k) => { s += swatchRect(x0 + 176 + k * 16, y - 7, 13, 13, rgb); });
    });
    return svg(520, 222, s);
}

function figRule0() {
    const c = TRI_COLORS();
    const b = EXAMPLE_B;
    const result = weighted(b, c);
    let s = labeledTriangle(6, 14, 0, { point: b });
    const x0 = 262;
    s += txt(x0, 26, 'At the circled fragment, b = (0.5, 0.3, 0.2):', { anchor: 'start', size: 11.5 });
    const rows = [[' ', b[0], c[0]], ['+', b[1], c[1]], ['+', b[2], c[2]]];
    rows.forEach(([op, w, rgb], i) => {
        const y = 56 + i * 30;
        s += txt(x0 + 6, y, op, { mono: true });
        s += txt(x0 + 22, y, f2(w) + ' ·', { anchor: 'start', mono: true, size: 11.5 });
        s += swatchRect(x0 + 72, y - 9, 18, 18, rgb);
        s += txt(x0 + 98, y, `(${rgb.map(fmt).join(', ')})`, { anchor: 'start', mono: true, size: 11.5 });
    });
    s += line(x0, 140, x0 + 220, 140, { color: '#777' });
    s += txt(x0 + 6, 160, '=', { mono: true });
    s += swatchRect(x0 + 72, 151, 18, 18, result);
    s += txt(x0 + 98, 160, `(${result.map(fmt).join(', ')})`, { anchor: 'start', mono: true, size: 11.5 });
    s += txt(x0, 196, 'λ0·C0 + λ1·C1 + λ2·C2', { anchor: 'start', mono: true, size: 12, fill: COL.bary });
    return svg(520, 225, s);
}

function figStaticRule(k) {
    const c = TRI_COLORS();
    const b = (k === 4) ? [0.6, 0.39, 0.01] : EXAMPLE_B;
    let s = labeledTriangle(6, 14, k, { point: b });
    const x0 = 262;
    const out = (y, label, rgb) => txt(x0, y, label, { anchor: 'start', mono: true, size: 11 }) +
        swatchRect(x0 + 200, y - 9, 18, 18, rgb);
    s += txt(x0, 26, `At the circled fragment, b = (${b.map(fmt).join(', ')}):`, { anchor: 'start', size: 11.5 });
    if (k === 1) {
        // Dashed borders: from the centroid to each edge's midpoint.
        const ctr = pointAt(TRI_PTS, [1 / 3, 1 / 3, 1 / 3]);
        [[0, 1], [1, 2], [2, 0]].forEach(([i, j]) => {
            const m = [(TRI_PTS[i][0] + TRI_PTS[j][0]) / 2, (TRI_PTS[i][1] + TRI_PTS[j][1]) / 2];
            s += line(6 + ctr[0], 14 + ctr[1], 6 + m[0], 14 + m[1], { color: '#000', dash: true, width: 1.5 });
        });
        s += txt(x0, 56, 'largest weight: b.x = 0.5', { anchor: 'start', mono: true, size: 11 });
        s += out(84, 'return c0', c[0]);
        s += txt(x0, 130, 'Dashed: two weights are equal.', { anchor: 'start', size: 11, fill: COL.dim });
    }
    if (k === 2 || k === 3) {
        const raw = (k === 2) ? b.map((x) => Math.pow(x, 4)) : b.map((x) => Math.floor(x * 4) / 4);
        const sum = raw[0] + raw[1] + raw[2];
        const w = raw.map((x) => x / sum);
        s += txt(x0, 56, (k === 2 ? 'b⁴' : 'floor(4·b) / 4') + ` = (${raw.map((x) => +x.toFixed(4)).join(', ')})`, { anchor: 'start', mono: true, size: 11 });
        s += txt(x0, 80, `÷ sum ${+sum.toFixed(4)} = (${w.map(f2).join(', ')})`, { anchor: 'start', mono: true, size: 11 });
        s += out(108, 'w.x·c0 + w.y·c1 + w.z·c2', weighted(w, c));
        s += txt(x0, 140, 'compare rule 0 (linear):', { anchor: 'start', size: 11, fill: COL.dim });
        s += swatchRect(x0 + 200, 131, 18, 18, weighted(b, c));
    }
    if (k === 4) {
        s += txt(x0, 56, 'distanceToEdge = min(b) = 0.01', { anchor: 'start', mono: true, size: 11 });
        s += txt(x0, 80, '0.01 &lt; 0.02 → near an edge', { anchor: 'start', mono: true, size: 11 });
        s += out(108, 'color = vec3(0.05)', [0.05, 0.05, 0.05]);
        s += txt(x0, 140, 'On an edge, the opposite', { anchor: 'start', size: 11, fill: COL.dim });
        s += txt(x0, 156, "vertex's weight is 0.", { anchor: 'start', size: 11, fill: COL.dim });
    }
    return svg(520, 225, s);
}

// Animated rules: a canvas redrawn every frame, plus the live values.
function figAnimatedRule() {
    return `<div class="miniRow">
        <canvas class="mini" id="miniCanvas"></canvas>
        <div class="miniNote" id="miniNote"></div>
      </div>
      <div class="caption">The triangle uses the same <code>uTime</code> as the live cube below.
        Pause the cube to freeze both.</div>`;
}
function drawAnimatedRule(time, k) {
    const cv = document.getElementById('miniCanvas');
    if (!cv) return;
    paintTriangles(cv, 240, 210, [{ pts: TRI_PTS.map(([x, y]) => [x + 5, y + 10]), colors: TRI_COLORS(), mode: k }], time);
    let note = `<code>uTime</code> = ${f2(time)} s<br>`;
    if (k === 5) {
        const phase = fract(time / 1.5);
        note += `The bands move inward by one ring every 1.5 s (now ${Math.round(phase * 100)}% of the way).`;
    }
    if (k === 6) {
        const { k: who, T } = rule6Turn(time);
        note += `Vertex <b>${who}</b>'s turn (C${who} ${colorName(TRI_COLORS()[who])}).<br>T = ${f2(T)}: it owns every fragment with λ${who} ≥ ${f2(1 - T)}.`;
    }
    if (k === 7) {
        note += `threshold = ${rule7Threshold(time).toFixed(3)}<br>(0.02 … 1/3 … 0.02 over 4 s)`;
    }
    document.getElementById('miniNote').innerHTML = note;
}

function figEvenOdd() {
    // One face, head-on: triangle 0 (BLUE, MAGENTA, WHITE) and triangle 1 (BLUE, WHITE, CYAN).
    const sz = 190, ox = 10, oy = 16;
    const BL = [0, sz], BR = [sz, sz], TR = [sz, 0], TL = [0, 0];
    const tris = [
        { pts: [BL, BR, TR], colors: [colorOf(0), colorOf(1), colorOf(2)].map((c) => Array.from(c)), mode: 1 },
        { pts: [BL, TR, TL], colors: [colorOf(3), colorOf(4), colorOf(5)].map((c) => Array.from(c)), mode: 4 },
    ];
    let s = triangleImage(ox, oy, sz, sz, tris);
    // (No outlines here: they would cover the black edges rule 4 draws.)
    const tag = (x, y, t) => `<text x="${x}" y="${y}" font-size="11" font-weight="bold" text-anchor="middle"
        fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${t}</text>`;
    s += tag(ox + sz * 0.74, oy + sz * 0.62, 'triangle 0 (even)');
    s += tag(ox + sz * 0.3, oy + sz * 0.3, 'triangle 1 (odd)');
    s += txt(ox + sz / 2, oy + sz + 14, 'the front face', { size: 11, fill: COL.dim });
    const x0 = 230;
    s += txt(x0, 20, 'vTriangle   % 2   rule', { anchor: 'start', mono: true, size: 11, fill: COL.dim });
    for (let t = 0; t < 6; t++) {
        const even = t % 2 === 0;
        s += txt(x0, 42 + t * 20, `${String(t).padStart(5)}${String(t % 2).padStart(9)}   ${even ? 'uModeEven' : 'uModeOdd'}`,
            { anchor: 'start', mono: true, size: 11, fill: even ? '#fff' : '#ffd54a' });
    }
    s += txt(x0, 172, 'Here: uModeEven = 1 (nearest vertex),', { anchor: 'start', size: 11 });
    s += txt(x0, 188, 'uModeOdd = 4 (wireframe), as on the cube.', { anchor: 'start', size: 11 });
    return svg(520, 225, s);
}

function figLighting() {
    const light = normalize3([0.5, 1.0, 0.3]);
    const faces = [0, 1, 2, 3, 4, 5].map((f) => {
        const n = normalOf(6 * f);
        const brightness = Math.max(n[0] * light[0] + n[1] * light[1] + n[2] * light[2], 0);
        return { name: FACE_NAMES[f], n, brightness, light: 0.3 + 0.7 * brightness };
    }).sort((a, b) => b.light - a.light);
    let s = txt(10, 14, `lightDirection = normalize(0.5, 1.0, 0.3) = (${light.map(f2).join(', ')})`, { anchor: 'start', mono: true, size: 11 });
    s += txt(10, 34, 'Before the cube turns:', { anchor: 'start', size: 11, fill: COL.dim });
    s += txt(10, 54, 'face     normal       brightness   light', { anchor: 'start', mono: true, size: 10.5, fill: COL.dim });
    faces.forEach((f, i) => {
        const y = 76 + i * 24;
        const label = `${f.name.padEnd(8)} (${f.n.map((v) => String(v).padStart(2)).join(',')})   ${f2(f.brightness).padStart(6)}`;
        s += txt(10, y, label.replace(/ /g, '&#160;'), { anchor: 'start', mono: true, size: 10.5 });
        s += `<rect x="300" y="${y - 8}" width="${f.light * 150}" height="16" fill="${css([f.light, f.light, f.light])}"/>`;
        s += txt(300 + f.light * 150 + 6, y, f2(f.light), { anchor: 'start', mono: true, size: 10.5 });
    });
    s += txt(10, 228, 'light = 0.3 + 0.7 · max(dot(vNormal, lightDirection), 0)', { anchor: 'start', mono: true, size: 11, fill: COL.bary });
    return svg(520, 240, s);
}

function figCompile() {
    let s = '';
    [['vertexShaderSource', 'vertex shader', 18], ['fragmentShaderSource', 'fragment shader', 98]].forEach(([src, sh, y]) => {
        s += boxText(4, y, 148, 40, [src, '(a string)'], { mono: true, size: 10.5 });
        s += arrow(154, y + 20, 196, y + 20);
        s += boxText(198, y, 110, 40, ['compileShader', '→ ' + sh], { size: 10.5, stroke: COL.pos });
    });
    s += arrow(310, 38, 352, 70);
    s += arrow(310, 118, 352, 86);
    s += txt(330, 102, 'link', { size: 10.5, fill: COL.dim, anchor: 'start' });
    s += boxText(354, 58, 90, 40, ['program'], { stroke: COL.pos });
    s += arrow(446, 78, 470, 78);
    s += txt(492, 70, 'use', { size: 10.5, anchor: 'middle' });
    s += txt(492, 86, 'Program', { size: 10.5, anchor: 'middle' });
    s += txt(4, 172, 'A GLSL error stops here: compileShader throws, and the message shows in the console.', { anchor: 'start', size: 11, fill: COL.dim });
    return svg(520, 185, s);
}

function figCubeCorners() {
    // A cabinet view: x right, y up, z toward you (drawn down-left).
    const S = 130, cx = 180, cy = 125;
    const proj = (p) => [cx + S * p[0] - 70 * p[2], cy - S * p[1] + 50 * p[2]];
    const corners = [];
    for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
        corners.push({ p: [x, y, z], rgb: [x + 0.5, y + 0.5, z + 0.5] });
    }
    let s = '';
    // The 12 edges. In this view the back-bottom-left corner (BLACK) is
    // hidden behind the cube, so its three edges are dashed.
    const edges = [];
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
        const d = corners[i].p.map((v, k) => Math.abs(v - corners[j].p[k]));
        if (d[0] + d[1] + d[2] === 1) edges.push([i, j]);
    }
    const isBlack = (c) => c.p[0] < 0 && c.p[1] < 0 && c.p[2] < 0;
    for (const [i, j] of edges) {
        const hidden = isBlack(corners[i]) || isBlack(corners[j]);
        const a = proj(corners[i].p), b = proj(corners[j].p);
        s += line(a[0], a[1], b[0], b[1], { color: '#777', dash: hidden });
    }
    // The front face's two triangles, colored as rule 0 draws them.
    const front = [0, 1, 2, 3, 4, 5].map((v) => proj(positionOf(v)));
    const minX = Math.min(...front.map((p) => p[0])), minY = Math.min(...front.map((p) => p[1]));
    const local = front.map(([x, y]) => [x - minX, y - minY]);
    s += triangleImage(minX, minY, S, S, [
        { pts: local.slice(0, 3), colors: [0, 1, 2].map((v) => Array.from(colorOf(v))), mode: 0 },
        { pts: local.slice(3, 6), colors: [3, 4, 5].map((v) => Array.from(colorOf(v))), mode: 0 },
    ]);
    s += `<polygon points="${front.slice(0, 3).map((p) => p.join(',')).join(' ')}" fill="none" stroke="#fff"/>`;
    s += `<polygon points="${front.slice(3, 6).map((p) => p.join(',')).join(' ')}" fill="none" stroke="#fff"/>`;
    // Vertex numbers in the buffer, pulled toward each triangle's center.
    [0, 1].forEach((t) => {
        const tri = front.slice(3 * t, 3 * t + 3);
        const ctr = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3];
        tri.forEach((p, i) => {
            const q = [p[0] + (ctr[0] - p[0]) * 0.32, p[1] + (ctr[1] - p[1]) * 0.32];
            s += `<circle cx="${q[0]}" cy="${q[1]}" r="8" fill="rgba(0,0,0,0.65)"/>`;
            s += txt(q[0], q[1] + 0.5, String(3 * t + i), { size: 10.5, mono: true, fill: '#fff' });
        });
    });
    // Corner dots and names.
    corners.forEach(({ p, rgb }) => {
        const [x, y] = proj(p);
        if (p[0] < 0 && p[1] < 0 && p[2] < 0) {          // BLACK, hidden behind the front face
            s += `<circle cx="${x}" cy="${y}" r="5" fill="#000" stroke="#ccc" stroke-dasharray="2 2"/>`;
            s += txt(x + 9, y + 12, 'BLACK (hidden)', { size: 10, anchor: 'start', fill: '#ddd' });
            return;
        }
        s += `<circle cx="${x}" cy="${y}" r="6" fill="${css(rgb)}" stroke="#ccc"/>`;
        const right = p[0] > 0;
        s += txt(x + (right ? 10 : -10), y + (p[1] > 0 ? -9 : 10), colorName(rgb), { size: 10.5, anchor: right ? 'start' : 'end', fill: '#ccc' });
    });
    const x0 = 352;
    s += txt(x0, 40, 'color = position + 0.5', { anchor: 'start', mono: true, size: 11 });
    s += txt(x0, 62, 'x → red', { anchor: 'start', size: 11, fill: '#f77' });
    s += txt(x0, 80, 'y → green', { anchor: 'start', size: 11, fill: '#7d7' });
    s += txt(x0, 98, 'z → blue (toward you)', { anchor: 'start', size: 11, fill: '#79f' });
    s += txt(x0, 136, 'Numbers: the order of', { anchor: 'start', size: 11, fill: COL.dim });
    s += txt(x0, 152, 'the front face\'s 6 vertices', { anchor: 'start', size: 11, fill: COL.dim });
    s += txt(x0, 168, 'in cubeVertices.', { anchor: 'start', size: 11, fill: COL.dim });
    return svg(520, 250, s);
}

function figRebuild() {
    const cellIn = 25, cellOut = 26;
    let s = txt(10, 12, 'cubeVertices: 9 floats per vertex (triangle 0 of the front face)', { anchor: 'start', size: 11, fill: '#bbb' });
    for (let v = 0; v < 3; v++) {
        const y = 22 + v * 26;
        const vals = Array.from(cubeVertices.slice(v * 9, v * 9 + 9));
        s += txt(10, y + 11, 'v' + v, { anchor: 'start', mono: true, size: 10.5, fill: COL.dim });
        for (let k = 0; k < 6; k++) {
            s += rect(32 + k * cellIn, y, cellIn, 22, { stroke: k < 3 ? COL.pos : COL.normal, rx: 1 });
            s += txt(32 + k * cellIn + cellIn / 2, y + 11, fmt(vals[k]), { mono: true, size: 9 });
        }
        s += swatchRect(32 + 6 * cellIn + 1, y, 3 * cellIn - 2, 22, vals.slice(6, 9));
        s += txt(32 + 7.5 * cellIn, y + 11, 'C' + v, { size: 10, fill: inkOn(vals.slice(6, 9)), weight: 'bold' });
    }
    s += txt(260, 112, 'for each triangle: every vertex gets its own BARY_COORDS[i] and ALL THREE colors', { size: 11, fill: COL.bary });
    s += arrow(260, 120, 260, 134);
    s += txt(10, 146, 'vertexList: 18 floats per vertex', { anchor: 'start', size: 11, fill: '#bbb' });
    for (let v = 0; v < 3; v++) {
        s += txt(10, 158 + v * 46 + 11, 'v' + v, { anchor: 'start', mono: true, size: 10.5, fill: COL.dim });
        s += vertexRecord(32, 158 + v * 46, cellOut, v, { showNames: v === 2, size: 9 });
        for (let g = 0; g < 3; g++) {
            const rgb = Array.from(colorOf(g));
            s += txt(32 + (9 + 3 * g + 1.5) * cellOut, 158 + v * 46 + 11, 'C' + g, { size: 10, fill: inkOn(rgb), weight: 'bold' });
        }
    }
    return svg(520, 310, s);
}

function figUpload() {
    let s = rect(4, 30, 210, 120, { stroke: '#666' });
    s += txt(109, 18, 'JavaScript (main memory)', { size: 11.5, fill: COL.dim });
    s += boxText(20, 64, 178, 54, ['vertexData', 'Float32Array', '36 × 18 = 648 floats'], { mono: true, size: 10.5, stroke: COL.bary });
    s += rect(300, 30, 216, 120, { stroke: COL.pos });
    s += txt(408, 18, 'GPU memory', { size: 11.5, fill: COL.dim });
    s += boxText(318, 82, 180, 50, ['buffer', '648 × 4 = 2592 bytes'], { mono: true, size: 10.5, stroke: COL.bary });
    s += arrow(200, 92, 316, 104, { width: 2 });
    s += txt(258, 86, 'bufferData', { mono: true, size: 10.5 });
    s += boxText(318, 40, 180, 24, 'ARRAY_BUFFER (binding point)', { size: 10, stroke: '#888' });
    s += arrow(408, 64, 408, 80);
    s += txt(452, 72, 'bindBuffer', { mono: true, size: 9.5, fill: COL.dim });
    s += txt(260, 176, 'createBuffer makes the empty buffer; bindBuffer points ARRAY_BUFFER at it;', { size: 11, fill: COL.dim });
    s += txt(260, 194, 'bufferData copies into whatever ARRAY_BUFFER points at.', { size: 11, fill: COL.dim });
    return svg(520, 205, s);
}

function figStride() {
    const cell = 13, x0 = 26, y = 52;
    let s = '';
    for (let v = 0; v < 2; v++) {
        ATTRS.forEach((a, g) => {
            const gx = x0 + (v * 18 + g * 3) * cell;
            s += rect(gx, y, 3 * cell, 26, { stroke: a.color, rx: 1, fill: v ? '#222' : COL.box });
            if (v === 0) s += txt(gx + 1.5 * cell, y - 24 + (g % 2) * 12, a.name, { size: 10, mono: true, fill: a.color });
            s += txt(gx, y + 40, String(v * 72 + g * 12), { size: 9.5, mono: true, fill: COL.dim });
        });
        s += txt(x0 + (v * 18 + 9) * cell, y + 13, v ? 'vertex 1' : 'vertex 0', { size: 10.5, fill: '#bbb' });
    }
    s += txt(x0 + 36 * cell, y + 40, '144', { size: 9.5, mono: true, fill: COL.dim });
    // Stride arrow and the aBary offsets.
    s += arrow(x0, y + 62, x0 + 18 * cell, y + 62, { color: '#fff' });
    s += txt(x0 + 9 * cell, y + 74, 'stride = 18 × 4 = 72 bytes', { size: 11 });
    s += arrow(x0 + 6 * cell, y + 100, x0 + 6 * cell, y + 50, { color: COL.bary });
    s += arrow(x0 + 24 * cell, y + 116, x0 + 24 * cell, y + 50, { color: COL.bary });
    s += txt(x0 + 6 * cell + 6, y + 108, 'aBary of vertex 0: offset 6 × 4 = 24', { size: 10.5, anchor: 'start', fill: COL.bary });
    s += txt(x0 + 24 * cell + 6, y + 124, 'vertex 1: 24 + 72 = 96', { size: 10.5, anchor: 'start', fill: COL.bary });
    s += txt(260, 200, "vertexAttribPointer(location, 3, FLOAT, false, stride, offset)", { mono: true, size: 11 });
    return svg(520, 212, s);
}

function figUniforms() {
    const rows = [
        ['', 'attribute (in)', 'uniform'],
        ['comes from', 'the buffer', 'JavaScript'],
        ['changes', 'every vertex', 'between draw calls'],
        ['look up with', 'getAttribLocation', 'getUniformLocation'],
        ['set with', 'vertexAttribPointer', 'uniformMatrix4fv, uniform1i, …'],
    ];
    let s = '';
    rows.forEach((r, i) => {
        const y = 20 + i * 26;
        s += txt(10, y, r[0], { anchor: 'start', size: 11, fill: COL.dim });
        s += txt(118, y, r[1], { anchor: 'start', size: 11, fill: i ? COL.text : COL.pos, weight: i ? 'normal' : 'bold', mono: i >= 3 });
        s += txt(282, y, r[2], { anchor: 'start', size: 11, fill: i ? COL.text : COL.uniform, weight: i ? 'normal' : 'bold', mono: i >= 3 });
    });
    s += line(10, 150, 510, 150, { color: '#444' });
    s += boxText(10, 162, 150, 34, tabText('menu: 0 … 7', 'two menus: 0 … 7'), { size: 11 });
    s += arrow(162, 179, 220, 179);
    s += txt(191, 170, 'draw()', { size: 10, mono: true, fill: COL.dim });
    s += boxText(222, 162, 200, 34, tabText('uniform int uMode', 'uModeEven, uModeOdd'), { mono: true, size: 11, stroke: COL.uniform });
    return svg(520, 205, s);
}

function figRotation() {
    const cx = 120, cy = 112, R = 80, th = 0.6;
    const c = Math.cos(th), sn = Math.sin(th);
    // Top view: x to the right, z down the page (toward you).
    const P = ([x, z]) => [cx + R * x, cy + R * z];
    let s = txt(cx, 12, 'seen from above (+y toward you)', { size: 11, fill: COL.dim });
    s += line(cx - 100, cy, cx + 100, cy, { color: '#444' });
    s += line(cx, cy - 95, cx, cy + 95, { color: '#444' });
    const sq = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    s += `<polygon points="${sq.map((p) => P(p).join(',')).join(' ')}" fill="none" stroke="#666" stroke-dasharray="4 3"/>`;
    const turned = sq.map(([x, z]) => [c * x + sn * z, -sn * x + c * z]);
    s += `<polygon points="${turned.map((p) => P(p).join(',')).join(' ')}" fill="rgba(79,193,255,0.12)" stroke="${COL.pos}"/>`;
    s += arrow(cx, cy, ...P([c, -sn]), { color: '#f77', width: 2 });
    s += arrow(cx, cy, ...P([sn, c]), { color: '#79f', width: 2 });
    s += txt(P([c, -sn])[0] + 6, P([c, -sn])[1] - 6, 'x axis → (c, 0, −s)', { anchor: 'start', size: 10.5, fill: '#f77' });
    s += txt(P([sn, c])[0] + 6, P([sn, c])[1] + 8, 'z axis → (s, 0, c)', { anchor: 'start', size: 10.5, fill: '#79f' });
    s += txt(cx + 104, cy - 4, 'x', { size: 10, fill: COL.dim });
    s += txt(cx + 6, cy + 100, 'z', { size: 10, fill: COL.dim });
    const x0 = 300;
    s += txt(x0, 30, 'rotationY(θ), one column per row:', { anchor: 'start', size: 11 });
    const cols = [['c, 0, −s, 0', '#f77', 'where x goes'], ['0, 1, 0, 0', '#7d7', 'where y goes'], ['s, 0, c, 0', '#79f', 'where z goes'], ['0, 0, 0, 1', COL.dim, '']];
    cols.forEach(([t, color, note], i) => {
        s += txt(x0, 54 + i * 20, t, { anchor: 'start', mono: true, size: 11, fill: color });
        s += txt(x0 + 100, 54 + i * 20, note, { anchor: 'start', size: 10.5, fill: COL.dim });
    });
    s += txt(x0, 148, 'c = cos θ, s = sin θ (here θ = 0.6)', { anchor: 'start', size: 10.5, fill: COL.dim });
    s += txt(x0, 180, 'multiply(a, b): b first, then a', { anchor: 'start', size: 11 });
    s += txt(x0, 198, 'model = rotationY(angle) ·', { anchor: 'start', mono: true, size: 10.5 });
    s += txt(x0, 214, '        rotationX(0.7·angle)', { anchor: 'start', mono: true, size: 10.5 });
    return svg(520, 222, s);
}

function figCamera() {
    // Side view: z to the right, y up. 55 px per unit.
    const U = 55, ox = 150, oy = 118;
    const P = (z, y) => [ox + U * z, oy - U * y];
    let s = txt(10, 14, 'Seen from the side (+x toward you)', { anchor: 'start', size: 11, fill: COL.dim });
    s += line(10, oy, 510, oy, { color: '#444' });
    const half = Math.tan(Math.PI / 8);            // tan(22.5°)
    const eye = P(3, 0);
    const reach = 4.0;
    s += `<polygon points="${eye.join(',')} ${P(3 - reach, reach * half).join(',')} ${P(3 - reach, -reach * half).join(',')}"
        fill="rgba(79,193,255,0.08)" stroke="${COL.pos}" stroke-dasharray="5 3"/>`;
    s += `<rect x="${P(-0.5, 0.5)[0]}" y="${P(-0.5, 0.5)[1]}" width="${U}" height="${U}" fill="rgba(197,134,192,0.25)" stroke="${COL.color}"/>`;
    s += txt(P(0, 0)[0], P(0, -0.75)[1], 'cube at (0, 0, 0)', { size: 10.5 });
    s += `<circle cx="${eye[0]}" cy="${eye[1]}" r="5" fill="#fff"/>`;
    s += txt(eye[0], eye[1] + 18, 'eye (0, 0, 3)', { size: 10.5 });
    s += arrow(eye[0] - 8, eye[1] - 24, eye[0] - 60, eye[1] - 24, { color: '#fff' });
    s += txt(eye[0] - 34, eye[1] - 36, 'looks at target', { size: 10 });
    s += txt(eye[0] - 70, eye[1] + 44, '45° field of view', { size: 10.5, fill: COL.pos });
    s += line(P(2.9, -0.04)[0], P(2.9, -0.04)[1], P(2.9, 0.04)[0], P(2.9, 0.04)[1], { color: '#fff', width: 2 });
    s += txt(P(2.9, 0)[0] + 40, oy + 62, 'near = 0.1 (tiny gap)', { size: 10, fill: COL.dim });
    s += txt(10, 230, '← far = 100 (way off to the left)', { size: 10, anchor: 'start', fill: COL.dim });
    s += txt(510, 230, 'up = (0, 1, 0): the camera\'s up is +y.', { anchor: 'end', size: 11 });
    return svg(520, 240, s);
}

function figDrawSetup() {
    const steps = [
        ['a', 'size the canvas, gl.viewport', '#666'],
        ['b', 'clearColor, enable(DEPTH_TEST), clear', '#666'],
        ['c', 'uProjection = perspective(…), uView = lookAt(…)', COL.uniform],
        ['d', 'uModel = rotationY(angle) · rotationX(0.7·angle)', COL.uniform],
        ['', tabText('uMode = menu value, uTime = seconds', 'uModeEven, uModeOdd = menus, uTime = seconds'), COL.uniform],
    ];
    let s = '';
    steps.forEach(([letter, t, stroke], i) => {
        const y = 8 + i * 38;
        s += txt(16, y + 15, letter, { weight: 'bold' });
        s += boxText(34, y, 380, 30, t, { mono: true, size: 10.5, stroke });
        if (i < steps.length - 1) s += arrow(224, y + 31, 224, y + 37);
    });
    s += txt(470, 104, 'then', { size: 10.5, fill: COL.dim });
    s += txt(470, 120, 'drawArrays', { size: 10.5, mono: true });
    s += txt(470, 136, '(next step)', { size: 10.5, fill: COL.dim });
    return svg(520, 200, s);
}

function figPipeline() {
    const boxes = [
        ['36 vertices', 'in the buffer'], ['vertex shader', '× 36'], ['rasterizer', '12 triangles → fragments'],
        ['fragment shader', '× each fragment'], ['depth test', 'nearest one wins'], ['pixels', 'on the canvas'],
    ];
    let s = '';
    boxes.forEach((lines, i) => {
        const row = Math.floor(i / 3), col = i % 3;
        const x = row === 0 ? 6 + col * 174 : 6 + (2 - col) * 174;
        const y = 14 + row * 96;
        s += boxText(x, y, 150, 46, lines, { size: 11, stroke: i === 1 || i === 3 ? COL.pos : '#666' });
        if (i === 2) s += arrow(x + 75, y + 48, x + 75, y + 94);
        else if (i < 5) s += row === 0 ? arrow(x + 152, y + 23, x + 172, y + 23) : arrow(x - 2, y + 23, x - 22, y + 23);
    });
    s += txt(390, 82, 'interpolates vBary, vNormal; flat ones unchanged', { size: 10, fill: COL.bary });
    s += txt(260, 176, 'gl.drawArrays(gl.TRIANGLES, 0, 36): one call starts all of this.', { mono: true, size: 10.5 });
    return svg(520, 190, s);
}

function figAnimate() {
    let s = txt(10, 14, 'Each frame: requestAnimationFrame calls animate(ms), animate draws, then asks again.', { anchor: 'start', size: 11 });
    const x0 = 30, dx = 75, y = 70;
    s += line(x0 - 10, y, x0 + 6 * dx + 10, y, { color: '#666' });
    for (let i = 0; i <= 6; i++) {
        const x = x0 + i * dx;
        const t = i / 60;
        s += `<circle cx="${x}" cy="${y}" r="5" fill="${COL.pos}"/>`;
        s += txt(x, y - 18, `${(t * 1000).toFixed(1)} ms`, { size: 10, mono: true, fill: COL.dim });
        s += txt(x, y + 18, `draw`, { size: 10, mono: true });
        if (i < 6) s += `<path d="M${x + 6},${y - 6} q${dx / 2 - 6},-20 ${dx - 12},0" fill="none" stroke="#666" marker-end="url(#arr)"/>`;
    }
    s += txt(10, 120, 'seconds = ms / 1000      angle = seconds × 0.3      uTime = seconds', { anchor: 'start', mono: true, size: 11 });
    s += txt(10, 150, 'At 60 frames per second the angle grows 0.005 per frame; at 30, 0.01 per frame.', { anchor: 'start', size: 11, fill: COL.dim });
    s += txt(10, 168, 'Either way it grows 0.3 per second.', { anchor: 'start', size: 11, fill: COL.dim });
    return svg(520, 180, s);
}


// ---------------------------------------------------------------------
// 4. THE CUBE'S DATA
//    Copied from tabs 5 and 6, section 2 (identical in both). We need the
//    data twice: in the GPU buffer, and in JavaScript for the overlays
//    and the pictures.
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

// The same loop as tabs 5 and 6: 9 → 18 floats per vertex.
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

// The name of a color constant ("BLUE").
function colorName(rgb) {
    for (const [name, value] of Object.entries(COLOR_NAMES)) {
        if (value[0] === rgb[0] && value[1] === rgb[1] && value[2] === rgb[2]) return name;
    }
    return '?';
}


// ---------------------------------------------------------------------
// 5. MATRIX HELPERS
//    rotationX, rotationY, multiply, perspective and lookAt are copied
//    from tabs 5 and 6 (column-major, like WebGL). transform() and
//    normalize3() are new: the overlay redoes the vertex shader's math.
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
// 6. REAL WEBGL 2
//    The same steps as tabs 5 and 6: compile the two shaders (the exact
//    strings from the tab's source), upload vertexData, connect the six
//    attributes, draw 36 vertices. One difference: the canvas size
//    includes window.devicePixelRatio, so it is sharp on high-DPI screens.
// ---------------------------------------------------------------------
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2');

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

// Draw one picture, as the tab's draw() does. In tab 5, `rule` is uMode
// and `ruleOdd` is ignored. `blank` only clears (nothing drawn yet).
function drawCube(m, rule, ruleOdd, seconds, blank) {
    resizeCanvas(canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.12, 0.12, 0.12, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (blank) return;
    gl.uniformMatrix4fv(uProjection, false, m.projection);
    gl.uniformMatrix4fv(uView, false, m.view);
    gl.uniformMatrix4fv(uModel, false, m.model);
    if (TAB === 5) {
        gl.uniform1i(uMode, rule);
    } else {
        gl.uniform1i(uModeEven, rule);
        gl.uniform1i(uModeOdd, ruleOdd);
    }
    gl.uniform1f(uTime, seconds);
    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
}


// ---------------------------------------------------------------------
// 7. THE OVERLAY ON THE LIVE CUBE
//    A transparent 2D canvas on top of the WebGL canvas. We redo the
//    vertex shader's math in JavaScript (P·V·M·position, divide by w,
//    viewport) to find where each vertex lands, then draw labels there.
//    Overlays:
//      bary      the focus triangle's aBary at its three vertices
//      colors    the focus triangle's C0, C1, C2 at its vertices
//      corners   the color name of every visible cube corner
//      triangles (tab 6) triangle numbers, and the focus triangle's IDs
//      evenOdd   (tab 6) even triangles solid, odd dashed, with the rule
//      outlines  every triangle that faces the camera
//    The focus triangle is the front-facing triangle that looks biggest.
// ---------------------------------------------------------------------
const overlayCanvas = document.getElementById('overlay');
const ctx = overlayCanvas.getContext('2d');

// Every vertex in CSS pixels of the canvas (y down).
function projectAll(m, width, height) {
    const pvm = multiply(m.projection, multiply(m.view, m.model));
    const out = [];
    for (let v = 0; v < VERTEX_COUNT; v++) {
        const clip = transform(pvm, [...positionOf(v), 1]);
        out.push({
            x: (clip[0] / clip[3] + 1) / 2 * width,
            y: (1 - clip[1] / clip[3]) / 2 * height,
        });
    }
    return out;
}

// Does triangle t face the camera? (turned normal · direction to the eye > 0)
function facesCamera(m, t) {
    const n = normalOf(3 * t);
    const M = m.model;
    const turned = [
        M[0] * n[0] + M[4] * n[1] + M[8] * n[2],
        M[1] * n[0] + M[5] * n[1] + M[9] * n[2],
        M[2] * n[0] + M[6] * n[1] + M[10] * n[2],
    ];
    const corner = transform(M, [...positionOf(3 * t), 1]);
    const toEye = [EYE[0] - corner[0], EYE[1] - corner[1], EYE[2] - corner[2]];
    return turned[0] * toEye[0] + turned[1] * toEye[1] + turned[2] * toEye[2] > 0;
}

// A text label with a dark box behind it, centered at (x, y).
function label(text, x, y, color = '#fff') {
    ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(x - w / 2, y - 8, w, 16);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
}

function drawOverlay(m, cfg) {
    resizeCanvas(overlayCanvas);
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (!cfg.overlay || cfg.blank) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);       // draw in CSS pixels

    const screen = projectAll(m, overlayCanvas.width / dpr, overlayCanvas.height / dpr);
    const corners = (t) => [screen[3 * t], screen[3 * t + 1], screen[3 * t + 2]];
    const centerOf = (t) => {
        const [a, b, c] = corners(t);
        return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    };
    const inset = (p, c, k = 0.3) => ({ x: p.x + (c.x - p.x) * k, y: p.y + (c.y - p.y) * k });
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
    const front = [];
    for (let t = 0; t < 12; t++) if (facesCamera(m, t)) front.push(t);
    let focus = front[0];
    let bestArea = -1;
    for (const t of front) {
        const [a, b, c] = corners(t);
        const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
        if (area > bestArea) { bestArea = area; focus = t; }
    }

    if (cfg.overlay === 'outlines') {
        for (const t of front) outline(t, '#fff', false, 1.5);
    }
    if (cfg.overlay === 'bary' || cfg.overlay === 'colors') {
        outline(focus, '#fff', false, 2.5);
        const center = centerOf(focus);
        corners(focus).forEach((p, i) => {
            const q = inset(p, center);
            if (cfg.overlay === 'bary') label(`(${BARY_COORDS[i].join(',')})`, q.x, q.y, '#ffd54a');
            else label(`C${i} ${colorName(Array.from(colorOf(3 * focus + i)))}`, q.x, q.y);
        });
    }
    if (cfg.overlay === 'corners') {
        const done = new Set();
        for (const t of front) {
            for (let i = 0; i < 3; i++) {
                const v = 3 * t + i;
                const key = positionOf(v).join(',');
                if (done.has(key)) continue;
                done.add(key);
                label(colorName(Array.from(colorOf(v))), screen[v].x, screen[v].y);
            }
        }
    }
    if (cfg.overlay === 'triangles') {
        for (const t of front) {
            outline(t, 'rgba(255,255,255,0.4)', false, 1);
            const c = centerOf(t);
            label(String(t), c.x, c.y);
        }
        outline(focus, '#fff', false, 2.5);
        const center = centerOf(focus);
        corners(focus).forEach((p, i) => {
            const q = inset(p, center);
            label(`id ${3 * focus + i}`, q.x, q.y, '#ffd54a');
        });
    }
    if (cfg.overlay === 'evenOdd') {
        for (const t of front) {
            const even = t % 2 === 0;
            outline(t, even ? '#fff' : '#ffd54a', !even, 2);
            const c = centerOf(t);
            label(`${t} ${even ? 'even' : 'odd'}`, c.x, c.y, even ? '#fff' : '#ffd54a');
        }
    }
}


// ---------------------------------------------------------------------
// 8. THE CODE PANEL
//    Only the current step's lines are shown in full. Gaps inside the
//    step's section fold into one "⋯ lines a–b" row, and every other
//    section folds into its title row. Clicking a fold row opens it to
//    peek (dimmed). Comment-only lines are hidden unless "Show the
//    file's comments" is checked; comments at the end of a code line
//    stay, dimmed.
// ---------------------------------------------------------------------
const codeBox = document.getElementById('code');

// The HTML for one line: code, then the "// comment" part dimmed.
function lineHtml(text) {
    const at = text.indexOf('//');
    if (at < 0) return escapeHtml(text);
    return escapeHtml(text.slice(0, at)) + '<span class="cm">' + escapeHtml(text.slice(at)) + '</span>';
}

// The rows for lines first..last, with the class `kind` ('step' or 'peek').
function lineRows(first, last, kind) {
    let html = '';
    let lastBlank = false;
    for (let n = first; n <= last; n++) {
        const text = SOURCE[n - 1];
        if (!state.showComments && isCommentOnly(text)) continue;
        if (isBlank(text)) {
            if (lastBlank) continue;          // one blank line is enough
            lastBlank = true;
        } else {
            lastBlank = false;
        }
        const changed = CHANGED_LINES.has(n);
        const firstChanged = changed && !CHANGED_LINES.has(n - 1);
        html += `<div class="line ${kind}${changed ? ' changed' : ''}" data-n="${n}">` +
            `<span class="ln">${n}</span><span class="src">${lineHtml(text) || ' '}</span>` +
            (firstChanged ? '<span class="tag6">changed in tab 6</span>' : '') + '</div>';
    }
    return html;
}

function renderCode(ranges) {
    const inStep = new Set();
    for (const [a, b] of ranges) for (let n = a; n <= b; n++) inStep.add(n);
    const sectionOf = (n) => SECTIONS.findIndex((s) => n >= s.start && n <= s.end);
    const stepSections = new Set([...inStep].map(sectionOf));

    let html = '';
    SECTIONS.forEach((section, i) => {
        const here = stepSections.has(i);
        const open = here || state.openSections.has(i);
        html += `<div class="fold${here ? ' here' : ''}" data-section="${i}">${open ? '▾' : '▸'} ` +
            `${escapeHtml(section.title)} <span class="count">(lines ${section.start}–${section.end})</span></div>`;
        if (!open) return;
        if (!here) {
            html += lineRows(section.start, section.end, 'peek');
            return;
        }
        let n = section.start;
        while (n <= section.end) {
            if (inStep.has(n)) {
                let m = n;
                while (m + 1 <= section.end && inStep.has(m + 1)) m++;
                html += lineRows(n, m, 'step');
                n = m + 1;
                continue;
            }
            let m = n;
            while (m + 1 <= section.end && !inStep.has(m + 1)) m++;
            const onlyComments = SOURCE.slice(n - 1, m).every((t) => isBlank(t) || isCommentOnly(t));
            if (onlyComments && !state.showComments) { n = m + 1; continue; }
            const isOpen = state.openGaps.has(n);
            html += `<div class="gap" data-gap="${n}">${isOpen ? '▴ fold' : '⋯'} lines ${n}–${m}` +
                ` (${m - n + 1} lines${onlyComments ? ', comments' : ', not part of this step'})</div>`;
            if (isOpen) html += lineRows(n, m, 'peek');
            n = m + 1;
        }
    });
    codeBox.innerHTML = html;
}

// Clicking a fold row or a gap row opens or closes it.
codeBox.addEventListener('click', (event) => {
    const fold = event.target.closest('.fold');
    const gap = event.target.closest('.gap');
    if (fold && !fold.classList.contains('here')) {
        const i = Number(fold.dataset.section);
        if (state.openSections.has(i)) state.openSections.delete(i); else state.openSections.add(i);
        renderCode(currentRanges());
    }
    if (gap) {
        const n = Number(gap.dataset.gap);
        if (state.openGaps.has(n)) state.openGaps.delete(n); else state.openGaps.add(n);
        renderCode(currentRanges());
    }
});

function scrollToStep() {
    const first = codeBox.querySelector('.line.step');
    if (first) codeBox.scrollTop = Math.max(0, first.offsetTop - codeBox.offsetTop - 60);
}


// ---------------------------------------------------------------------
// 9. NAVIGATION
//    A box per section of the file with one dot per step. Prev / Next,
//    the arrow keys, and ?step=N. The tab switch keeps the same step
//    (by id); a tab-6-only step falls back to the step before it.
// ---------------------------------------------------------------------
const SECTION_NAMES = ['0. Context', '1. Shaders', '2. Geometry → buffer', '3. Matrices', '4. Draw', '5. Animate'];
const nav = document.getElementById('sectionNav');

function buildNav() {
    nav.innerHTML = '';
    SECTION_NAMES.forEach((name, s) => {
        const indexes = STEPS.map((step, i) => (step.section === s ? i : -1)).filter((i) => i >= 0);
        const box = document.createElement('div');
        box.className = 'sec';
        box.dataset.section = s;
        box.innerHTML = `<span class="name">${escapeHtml(name)}</span><span class="dots"></span>`;
        box.addEventListener('click', (event) => {
            if (!event.target.closest('.dot')) goTo(indexes[0]);
        });
        const dots = box.querySelector('.dots');
        for (const i of indexes) {
            const dot = document.createElement('button');
            dot.className = 'dot' + (STEPS[i].only ? ' tab6' : '');
            dot.dataset.index = i;
            dot.title = `Step ${i + 1}: ${stepTitle(STEPS[i])}`;
            dot.setAttribute('aria-label', dot.title);
            dot.addEventListener('click', () => goTo(i));
            dots.appendChild(dot);
        }
        nav.appendChild(box);
    });
}

function stepTitle(step) {
    return typeof step.title === 'function' ? step.title(choiceOf(step)) : step.title;
}
function choiceOf(step) {
    return step.picker ? (state.pick[step.id] ?? step.picker.start) : null;
}
function currentRanges() {
    const step = STEPS[state.step];
    return resolveRanges(step.ranges(choiceOf(step)), step.within);
}

// The step number (1-based) to open in the other tab.
function stepInOtherTab(otherTab) {
    const others = ALL_STEPS.filter((s) => !s.only || s.only === otherTab);
    let at = ALL_STEPS.indexOf(STEPS[state.step]);
    while (at > 0 && !others.includes(ALL_STEPS[at])) at--;
    return others.indexOf(ALL_STEPS[at]) + 1;
}

function renderStep({ scroll = true } = {}) {
    const step = STEPS[state.step];
    const choice = choiceOf(step);
    state.seen.add(state.step);

    document.getElementById('stepWhere').textContent =
        `Step ${state.step + 1} of ${STEPS.length} · ${SECTION_NAMES[step.section]}`;
    document.getElementById('stepTitle').textContent = stepTitle(step);
    document.getElementById('stepText').innerHTML = step.text(choice);
    document.getElementById('figure').innerHTML = step.figure(choice);

    const picker = document.getElementById('picker');
    picker.hidden = !step.picker;
    if (step.picker) {
        picker.innerHTML = step.picker.choices.map((k) =>
            `<button data-rule="${k}" class="${k === choice ? 'current' : ''}">${k}. ${RULE_NAMES[k]}</button>`).join('');
    }

    // The live cube.
    const cfg = step.cube(choice);
    state.cube = cfg;
    document.getElementById('cubeNote').textContent = cfg.note || '';
    if (!cfg.spin) state.seconds = POSE_TIME;
    setPlaying(!!cfg.spin);
    if (step.drawFigure) step.drawFigure(state.seconds, choice);

    renderCode(currentRanges());
    if (scroll) scrollToStep();

    // Navigation state.
    for (const dot of nav.querySelectorAll('.dot')) {
        const i = Number(dot.dataset.index);
        dot.classList.toggle('current', i === state.step);
        dot.classList.toggle('seen', state.seen.has(i));
    }
    for (const box of nav.querySelectorAll('.sec')) {
        box.classList.toggle('current', Number(box.dataset.section) === step.section);
    }
    for (const id of ['prev', 'prevTop']) document.getElementById(id).disabled = state.step === 0;
    for (const id of ['next', 'nextTop']) document.getElementById(id).disabled = state.step === STEPS.length - 1;

    // The tab switch and the address bar.
    document.getElementById('tab5Link').href = `?tab=5&step=${TAB === 5 ? state.step + 1 : stepInOtherTab(5)}`;
    document.getElementById('tab6Link').href = `?tab=6&step=${TAB === 6 ? state.step + 1 : stepInOtherTab(6)}`;
    history.replaceState(null, '', `?tab=${TAB}&step=${state.step + 1}`);
}

function goTo(index) {
    if (index < 0 || index >= STEPS.length) return;
    state.step = index;
    state.openSections.clear();
    state.openGaps.clear();
    renderStep();
}

document.getElementById('picker').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    state.pick[STEPS[state.step].id] = Number(button.dataset.rule);
    state.openGaps.clear();
    renderStep();
});
for (const id of ['prev', 'prevTop']) document.getElementById(id).addEventListener('click', () => goTo(state.step - 1));
for (const id of ['next', 'nextTop']) document.getElementById(id).addEventListener('click', () => goTo(state.step + 1));
document.addEventListener('keydown', (event) => {
    // Arrow keys move between steps, except while typing or using a menu.
    if (event.target.closest?.('select, textarea, input[type=text], input[type=range]')) return;
    if (event.key === 'ArrowRight') goTo(state.step + 1);
    if (event.key === 'ArrowLeft') goTo(state.step - 1);
});
document.getElementById('showComments').addEventListener('change', (event) => {
    state.showComments = event.target.checked;
    renderCode(currentRanges());
    scrollToStep();
});


// ---------------------------------------------------------------------
// 10. STATE AND THE ANIMATION LOOP
//    Like the tabs, the angle and uTime both come from one clock
//    (state.seconds). Steps about still things pause it at POSE_TIME;
//    the Play / Pause button overrides that.
// ---------------------------------------------------------------------
const startStep = Number(new URLSearchParams(window.location.search).get('step')) || 1;
const state = {
    step: Math.min(Math.max(startStep, 1), STEPS.length) - 1,
    seconds: POSE_TIME,
    playing: true,
    lastNow: null,
    cube: null,
    pick: {},                  // step id → chosen rule (steps with a picker)
    seen: new Set(),
    showComments: false,
    openSections: new Set(),   // sections a student opened to peek
    openGaps: new Set(),       // gaps (by first line) a student opened
};

const playButton = document.getElementById('playPause');
function setPlaying(playing) {
    state.playing = playing;
    playButton.textContent = playing ? 'Pause' : 'Play';
}
playButton.addEventListener('click', () => setPlaying(!state.playing));

const readout = document.getElementById('readout');
function frame(now) {
    if (state.lastNow !== null && state.playing) state.seconds += (now - state.lastNow) / 1000;
    state.lastNow = now;

    const cfg = state.cube;
    const step = STEPS[state.step];
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const m = matricesAt(state.seconds, aspect);
    const ruleOdd = cfg.ruleOdd ?? cfg.rule ?? 0;
    drawCube(m, cfg.rule ?? 0, ruleOdd, state.seconds, cfg.blank);
    drawOverlay(m, cfg);
    if (step.drawFigure && state.playing) step.drawFigure(state.seconds, choiceOf(step));

    readout.innerHTML = cfg.blank ? '' :
        `uTime = ${f2(state.seconds)} s<br>angle = ${f2(state.seconds * SPIN_SPEED)} rad<br>` +
        (TAB === 5 ? `uMode = ${cfg.rule ?? 0}` : `uModeEven = ${cfg.rule ?? 0}<br>uModeOdd = ${ruleOdd}`);
    requestAnimationFrame(frame);
}

document.getElementById('fileName').textContent = TAB_INFO[TAB].file;
document.getElementById('codeLegend').innerHTML = TAB === 6
    ? `<span style="border-left:3px solid var(--tab6);padding-left:4px">orange bar</span> = changed from tab 5`
    : '';
document.getElementById(TAB === 6 ? 'tab6Link' : 'tab5Link').classList.add('current');
buildNav();
renderStep();
requestAnimationFrame(frame);
