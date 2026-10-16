# Ways to color a cube: notes

Development history for this example. Current rules, structure, and
sync requirements are in `CLAUDE.md` next to this file. This file merges
the old `IMPLEMENTATION.md` and `PLAN.md` (2026-10-16). Content that moved
to `CLAUDE.md` (file table, sync rules, Tab 5 as built, testing) or to the
root `CLAUDE.md` (terminology) is not repeated here.

**Removed on 2026-10-16:** `example-cube.js` (the original single-cube
program this example was based on; it had a stray `I` on line 1 and didn't
run), the unused `index.js`, and `package.json`. The plan below still
refers to `example-cube.js` as "the original".

## Build history (from IMPLEMENTATION.md)

Status: **done and verified** (2026-10-15).

History: the project started as three tabs (`1-solid-color`,
`2-face-colors`, `3-vertex-interpolation`). The do-it-yourself tab was
added as Tab 4, and then the uniform version was inserted as Tab 1, so
every older file moved up by one (`1-solid-color` → `2-solid-attribute`).
All of this happened on 2026-10-15.

Not touched: `example-cube.js` (still has the stray `I` on line 1, so it
won't run), `index.js`, `package.json` (unused by this project).
Nothing has been committed to git.

### Open questions from PLAN.md §6, as resolved

1. Barycentric: built-in interpolation in Tab 4, explained in comments
   (user decided). The explicit version became Tab 5.
2. Lighting: kept (0.3 ambient + 0.7 diffuse) in every tab (plan default).
3. Color as uniform or attribute: originally an attribute everywhere. Later
   the user chose to show **both**: Tab 1 uniform, Tab 2 attribute.
4. Tab 4: RGB color cube (plan default).
5. Files placed directly in this directory (user decided).

### Small decisions not spelled out in the plan

- Clear color is dark gray `(0.12, 0.12, 0.12)`, not black, so Tab 4's black
  cube corner is visible against the background.
- Camera: `lookAt([0, 0, 3], [0, 0, 0], [0, 1, 0])`, 45° FOV.
- Animation: `SPIN_SPEED = 0.8` rad/s, angle = elapsed seconds × speed
  (uses the `requestAnimationFrame` timestamp). Model =
  `rotationY(a) × rotationX(0.7a)`.
- `draw()` resizes the canvas only when its client size changed (instead of
  every frame); there's no separate `resize` listener because the loop
  redraws every frame anyway.
- Section numbering in the JS: 0 context, 1 shaders, 2 geometry/buffer,
  3 matrix helpers, 4 draw, 5 animate.
- The cube's triangles keep the same vertex order as `example-cube.js`,
  with y shifted by −0.5 to center it.
- The tab bar uses `flex-wrap: wrap` so five tabs fit on narrow screens.

### Possible next steps (not requested yet)

- Commit the work to git.

## The original plan (PLAN.md, unchanged)

## Plan: Five Ways to Color a Cube

A small WebGL teaching project, in the same style as `example-cube.js`:
plain WebGL with no libraries, no build step, simply written, and
commented heavily, both by section and line by line.

Students click between five tabs. Each tab shows one rotating cube colored
a different way:

| Tab | File | Coloring approach |
|-----|------|-------------------|
| 1. Solid (uniform) | `1-solid-uniform.js` | One color for the whole cube, sent as a **uniform** (as in `example-cube.js`). No color in the vertex data. *(Added later; see §8.)* |
| 2. Solid (attribute) | `2-solid-attribute.js` | Every vertex has the **same** color, so the cube is one color. |
| 3. Face colors | `3-face-colors.js` | The 6 vertices of each face share a color, and each face gets a **different** color. |
| 4. Interpolated | `4-vertex-interpolation.js` | Each corner of the cube has a **different** color. The GPU interpolates the colors across each triangle using **barycentric coordinates**. |
| 5. Do-it-yourself interpolation | `5-custom-interpolation.js` | Same corner colors as Tab 4, but the **fragment shader** does the interpolation itself from barycentric weights. Students can change the interpolation rule. *(Added later; see §7.)* |

---

### 1. Main design idea: same code, different data

Tabs 2–4 **use the same shaders, buffer layout, matrices, animation
and draw loop**. The only thing that changes is the **color column of the
vertex array**.

Students can diff the files to see this:

```
diff 2-solid-attribute.js 3-face-colors.js
```

Apart from the header comment and the color numbers, the diff should be empty.

The point for students: *in the pipeline, "how a cube is colored" is decided
by the per-vertex data you send and by how the rasterizer interpolates it.
The shader code does not need to change.*

To make this possible, each vertex carries its own color (an `attribute`)
in all three versions. The cube color is no longer a `uniform` as it was in
`example-cube.js`. Each vertex now has **9 floats**:

```
 x,    y,    z,      nx, ny, nz,      r,   g,   b
(position)          (normal)         (color)        stride = 9 × 4 = 36 bytes
```

The color travels as follows:

```
aColor (attribute, per vertex)  →  vColor (varying)  →  fragment shader
                                     ↑
               the rasterizer interpolates it across the triangle
               (barycentric weights) for each pixel
```

- **Tab 2:** all three corners of every triangle have the same color, so the
  interpolated color is constant.
- **Tab 3:** the three corners of a triangle share their face's color, so the
  color is constant on each face and changes sharply at edges.
- **Tab 4:** the three corners of a triangle have different colors, so the
  color is interpolated smoothly. Here the interpolation becomes **visible**.

Students should see that interpolation happens in **all three** cubes. You
can only *see* it in the third one.

---

### 2. Files

```
untitled3/                (this directory, alongside example-cube.js)
├── 1-solid-uniform.html          same page, loads 1-solid-uniform.js (see §8)
├── 1-solid-uniform.js            complete program, color as a uniform
├── 2-solid-attribute.html            tab bar + canvas + caption, loads 2-solid-attribute.js
├── 2-solid-attribute.js              complete program, solid color data
├── 3-face-colors.html            same page, loads 3-face-colors.js
├── 3-face-colors.js              complete program, per-face color data
├── 4-vertex-interpolation.html   same page, loads 4-vertex-interpolation.js
├── 4-vertex-interpolation.js     complete program, per-corner color data
├── 5-custom-interpolation.html   same page + a interpolation-rule dropdown (see §7)
└── 5-custom-interpolation.js     complete program, interpolation done in the fragment shader
```

**No server needed.** Open any of the `.html` files by double-clicking it.
Start with `1-solid-uniform.html`.

- **Each JS file is a complete program on its own**, like `example-cube.js`.
  There is no shared "common.js". A student can open one file and read it
  from top to bottom without jumping between files, and the diffs stay
  clean. The cost is that about 95% of the code is duplicated on purpose.
  The header comment of each file will say so.
- **One HTML page per example.** The three pages are identical except for
  three things: which tab is highlighted, the caption text, and which
  `<script src>` they load. Each page holds:
  - a tab bar made of 3 plain `<a href>` links to the three pages, with the
    current page's tab highlighted. No JavaScript is needed for tabs.
  - one `<canvas id="c">`, the same id `example-cube.js` uses,
  - a short caption explaining that page's coloring approach,
  - inline CSS (no separate stylesheet),
  - a plain `<script src="...">` tag at the end of `<body>`. Each page loads
    only one program, so the shared names (`gl`, `program`, …) never clash.
    This is why no server or modules are needed.

---

### 3. Structure of each JS file (same in all three)

Following the numbered sections of `example-cube.js`:

0. **Get the WebGL context** from `<canvas id="c">`, exactly as in the
   original.
1. **Shaders**
   - Vertex shader: `aPosition`, `aNormal`, **`aColor`** → `vNormal`,
     **`vColor`**. Includes a comment explaining that varyings are
     interpolated with barycentric weights.
   - Fragment shader: the same simple lighting as the original
     (`0.3 ambient + 0.7 diffuse`), applied to `vColor`.
2. **Cube geometry → buffer**
   - A cube **centered at the origin** (−0.5 to 0.5 on every axis). The
     original cube sits on y = 0; centering it makes it spin around its
     middle.
   - 36 vertices (6 faces × 2 triangles × 3), with 9 floats each.
   - Named color constants at the top make the color column easy to read,
     for example:
     ```js
     const RED = [1, 0, 0];
     ...
     -0.5, -0.5, 0.5,   0, 0, 1,   ...RED,
     ```
   - **This section is the only part that differs between the files.**
   - Three `vertexAttribPointer` calls: position at offset 0, normal at
     offset 12, color at offset 24.
3. **Matrix helpers.** `multiply`, `perspective` and `lookAt` from the
   original, plus **`rotationX(angle)`** and **`rotationY(angle)`** for the
   spin. (`translation`/`scaling` are dropped because they are no longer
   needed.)
4. **Draw.** Same steps a–d as the original. The model matrix becomes
   `rotationY(t) × rotationX(0.7·t)` so the cube tumbles and shows all 6
   faces.
5. **Animate.** A `requestAnimationFrame` loop. The angle is computed from
   elapsed time, not frame count, so all three cubes spin at the same speed
   on any computer. This closes the loop on the original file's closing
   comment ("To animate, you would instead call draw() every frame…").

The normal is transformed with `mat3(uModel)` as in the original. The
original comment said "it would matter if you added rotation", and now it
does. That comment will be updated to explain why this is correct for a pure
rotation.

---

### 4. The color data in each file

**1 – Solid color.** All 36 vertices use `CUBE_COLOR` (for example orange,
`[1.0, 0.5, 0.1]`). Even with one color, lighting still makes the faces look
different. This is a good discussion point: without lighting the cube would
be a flat silhouette.

**2 – Face colors.** Six named colors, one per face (red, green, blue,
yellow, cyan, magenta). Every vertex of the front face is red, and so on.
Comments explain *why the vertices are not shared*: a cube corner touches 3
faces that need 3 different colors. One position therefore has to be stored
as 3 separate vertices, which is why there are 36 vertices instead of 8.

**3 – Interpolated (per-corner) colors.** Each of the **8 cube corners**
gets one color. Every vertex at that corner uses that color, whichever face
it belongs to. Default is the classic **RGB color cube**, where corner
(x, y, z) maps to color (x+0.5, y+0.5, z+0.5): black at one corner, white at
the opposite one, and red, green, blue, cyan, magenta and yellow at the
rest. Comments explain:
- barycentric coordinates (λ₀, λ₁, λ₂) with λ₀ + λ₁ + λ₂ = 1,
- color at a pixel = λ₀·C₀ + λ₁·C₁ + λ₂·C₂,
- this is done for every `varying`. The rasterizer does it automatically
  (perspective-correct), between the vertex and fragment shader.
- (Optional discussion) Each face is 2 triangles, so the interpolation across a
  face is not a perfect bilinear interpolation. The diagonal can sometimes be seen.

---

### 5. What stays out (to keep it simple)

- No libraries (no glMatrix, no three.js) and no build tools.
- No index buffers (`drawElements`). The original uses `drawArrays`, and
  so will this project.
- No mouse controls. The cube just rotates.
- No web server, ES modules or tab-switching JavaScript.
- `package.json` / `index.js` are not used.

---

### 6. Open questions (my default in brackets)

1. **Barycentric: built in or explicit?** Should Tab 4 rely on the GPU's
   built-in varying interpolation, with comments explaining that it *is*
   barycentric interpolation? Or should students see barycentric weights
   computed explicitly in the shader (an extra `aBarycentric` attribute plus
   `λ₀C₀ + λ₁C₁ + λ₂C₂` in the fragment shader)? The explicit version
   makes the math visible, but then file 4's code differs from files 2 and 3.
   **DECIDED: built in, with thorough comments.** The explicit version
   becomes its own tab instead: see §7 (Tab 5).
2. **Lighting:** keep the original's simple lighting in all three, or remove
   it so students see pure colors? *[Keep it. Without it, cube 1 is a flat
   blob.]*
3. **Color as an attribute in the solid tab too**, or keep the original's `uniform
   uColor` for the solid cube? *[Attribute everywhere, so the files differ
   only in data.]*
4. **Tab 4 colors:** RGB color cube (color = position), or hand-picked or
   random colors per corner? *[RGB color cube.]*
5. **Location:** a new `cube-coloring/` folder inside this directory, or
   files placed directly in this directory? **DECIDED: directly in this
   directory.**

---

### 7. Tab 5: the fragment shader does its own interpolation

**Goal.** In Tab 4 the rasterizer interpolates the corner colors, and students
only read about the barycentric weights in comments. Tab 5 does that interpolation
**in the fragment shader**, where students can see it and change it. The
fragment shader gets the triangle's three corner colors and its barycentric
weights (λ₀, λ₁, λ₂), and a small `interpolate()` function decides the final
color. With the default "linear" rule, Tab 5 should look **the same as
Tab 4**. That is the sanity check, and it shows that the hardware was doing
exactly this all along.

This tab **breaks the "same code, different data" rule on purpose.** The
shaders and buffer layout change. The diff that matters here is

```
diff 4-vertex-interpolation.js 5-custom-interpolation.js
```

and it shows exactly what moved from the hardware into our own code.

#### How the data gets to the fragment shader

A fragment shader never sees the three vertices of its triangle; it only
gets interpolated varyings. Two tricks, both plain WebGL 1 (no extensions,
no `flat`, which WebGL 1 lacks):

1. **Barycentric attribute `aBary`.** The 1st vertex of each triangle gets
   `(1,0,0)`, the 2nd `(0,1,0)` and the 3rd `(0,0,1)`. After interpolation,
   `vBary` at a pixel *is* (λ₀, λ₁, λ₂).
2. **All three corner colors on every vertex:** `aColor0`, `aColor1`,
   `aColor2`. All 3 vertices of a triangle carry the **same** three colors.
   Interpolating three equal values gives that value back, so they reach the
   fragment shader unchanged. Comments point out that this is the same
   effect as Tab 2, where all corners share a color: the varying still gets
   interpolated, but it can't change.

Each vertex grows from 9 to **18 floats**:

```
 x, y, z,   nx, ny, nz,   λ0, λ1, λ2,   r0,g0,b0,   r1,g1,b1,   r2,g2,b2
(position)  (normal)      (bary)        (corner 0)  (corner 1)  (corner 2)
                                                    stride = 18 × 4 = 72 bytes
```

That is 6 attributes. WebGL 1 guarantees at least 8, so this is fine.

**No index buffers.** The project already uses 36 separate vertices with
`drawArrays`, which this trick needs anyway: a vertex shared by two triangles
could need `(1,0,0)` in one and `(0,1,0)` in the other. Comments say so,
which ties back to Tab 3's "why 36 vertices, not 8".

#### Building the vertex array

Writing 36 × 18 numbers by hand would be unreadable. Section 2 instead:

- keeps Tab 4's corner color constants (BLACK … WHITE) and the same cube
  triangles with their colors, and
- runs a short, heavily commented loop that goes through the triangles,
  3 vertices at a time, and adds each vertex's `aBary` and its triangle's 3
  corner colors to the array.

The loop is the one place where the data layout is built by code instead of
by hand. The comments will explain why.

#### Fragment shader: the interpolation rule

```glsl
uniform int uMode;          // which interpolation rule (set from the page)
varying vec3 vBary;         // (λ0, λ1, λ2) for this pixel
varying vec3 vColor0, vColor1, vColor2;   // the triangle's corner colors

vec3 interpolate(vec3 b, vec3 c0, vec3 c1, vec3 c2) {
  if (uMode == 0) return b.x*c0 + b.y*c1 + b.z*c2;   // linear: same as Tab 4
  ...
}
```

Starter rules, each a few lines with a comment saying what to look for:

| # | Rule | Idea | What students see |
|---|------|------|-------------------|
| 0 | Linear | `λ0·C0 + λ1·C1 + λ2·C2` | Same as Tab 4 |
| 1 | Nearest vertex | Use the color of the vertex with the biggest λ | Each triangle splits into 3 flat regions. The face diagonal becomes obvious. |
| 2 | Sharpened | Raise each λ to a power k, then renormalize so they add to 1 | Corners stay "pure" longer, and mixing squeezes toward the middle |
| 3 | Bands | Round each λ to steps (posterize) | Visible contour lines of the weights |
| 4 | Wireframe | Linear, but darken where `min(λ) < threshold` | Triangle edges drawn on the faces, including the diagonals |

Lighting stays the same (`0.3 ambient + 0.7 diffuse`), applied to the
interpolated color.

**Making new rules:** students add a new `if (uMode == 5)` case with their
own formula and a matching `<option>` in the HTML. A comment block above
`interpolate()` gives this "how to add a rule" recipe.

#### Page changes

- `5-custom-interpolation.html` adds a `<select>` dropdown under the canvas
  listing the rules. A few lines of JS set `uMode` when it changes. This is
  the project's only UI, and it is deliberately tiny.
- **The tab bar on all four pages gets a 4th link.** This is an edit to
  `2-…`, `3-…` and `4-….html`. It does not touch the `.js` files, so the
  diffs between Tabs 2–4 stay clean.
- The caption explains: "Same corner colors as Tab 4. This time the fragment
  shader does the interpolation. Try the different rules."

#### Discussion points for the comments and caption

- With rule 0 the result matches Tab 4, so the rasterizer *was* computing
  barycentric weights. (Varyings in WebGL are perspective-correct, so
  `vBary` is too, and the match holds.)
- Rules 1 and 4 make the 2 triangles per face visible. This answers Tab 4's
  "optional diagonal" note directly.
- On desktop GPUs, this used to be done with a **geometry shader**, and newer
  APIs let the fragment shader read per-vertex values directly (barycentric
  extensions). WebGL has neither, so the attribute trick is the portable
  way. One short paragraph in the header comment; no code.

#### Open questions for Tab 5 (my default in brackets)

1. **How students switch rules:** a dropdown that sets a `uniform int`, or
   just edit a `const int MODE` in the shader and reload? *[Dropdown. All
   rules stay comparable live, and students still edit the shader to add
   new ones.]*
2. **Colors:** same RGB color cube as Tab 4? *[Yes, so rule 0 can be
   checked against Tab 4.]*
3. **Rule set:** the five above, or fewer? *[All five; each is 1–4 lines.]*

---

### 8. New Tab 1: solid color as a uniform (added later)

**Why.** In the original three tabs the solid cube stored its color as an
attribute, copied into all 36 vertices, so that the files differed only in
data. That hid the more natural choice for a one-color object: a
**uniform**. The fix keeps both versions and renumbers the tabs:

| Tab | File | Was |
|-----|------|-----|
| 1. Solid (uniform) | `1-solid-uniform.js` | *(new)* |
| 2. Solid (attribute) | `2-solid-attribute.js` | `1-solid-color.js` |
| 3. Face colors | `3-face-colors.js` | `2-face-colors.js` |
| 4. Interpolated | `4-vertex-interpolation.js` | `3-vertex-interpolation.js` |
| 5. Do-it-yourself interpolation | `5-custom-interpolation.js` | `4-custom-interpolation.js` |

(Tab numbers elsewhere in this plan use the new numbering.)

**Each neighboring diff now changes exactly one thing:**
- 1 → 2: the color moves from a uniform to an attribute. The *code*
  changes (shaders, buffer layout, one `vertexAttribPointer`, the
  `gl.uniform3fv` call) and the *picture* stays exactly the same.
- 2 → 3 and 3 → 4: only the color data changes.
- 4 → 5: interpolation moves into the fragment shader.

**Tab 1 code** (derived from Tab 2 so the diff is minimal):
- No `aColor`, `vColor`; the fragment shader has `uniform vec3 uColor`.
- 6 floats per vertex (position + normal), stride 24 bytes.
- `draw()` calls `gl.uniform3fv(uColor, CUBE_COLOR)`, with a comment that it
  could be set once at setup because uniforms keep their value.
- Header comment explains *how often* each kind of variable changes
  (uniform per draw, attribute per vertex, varying per fragment) and why a
  uniform can't give each face its own color.
- The fragment definition stays in the vertex shader comments, reworded
  for "the only varying is vNormal".

Open question 3 in §6 is now answered both ways: Tab 1 uses a uniform and
Tab 2 uses an attribute.

---

Side note: line 1 of `example-cube.js` begins with a stray `I`
(`I// ====`). This is a syntax error that stops the original from running.

## 2026-10-16: GLSL highlighting markers

Added `// language=GLSL` above and `/* glsl */` before the backtick of
every shader string, plus a short note about them in the shaders header
comment. This is the project-wide rule now (root `CLAUDE.md`; why: see
`notes/NOTES.md`, "shader syntax highlighting"). Comments only; the
program is unchanged.

Applied with one script so the added lines are identical in all five
files. Checked: `node --check` on all five; each of the four neighboring
diffs is exactly what it was before (compared without line numbers); all
five pages link their programs with no console errors.
