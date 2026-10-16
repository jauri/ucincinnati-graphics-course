# Project notes: WebGL examples

Development history for the project as a whole. History for a single
example is in that example's `NOTES.md`. Current rules are in the root
`CLAUDE.md`.

## 2026-10-16: project set up and restructured

### Set up
- Created the root `CLAUDE.md` and `README.md`. Placeholder files
  `notes/conventions.md`, `notes/concepts-roadmap.md`, and an empty
  `common/` folder were also created, then removed later the same day (see
  below).
- Decided: **WebGL 2** is the target for the project.

### Examples added
The instructor copied in three existing examples, each developed
separately in earlier sessions: `examples/cube-grid/`,
`examples/camera-move/`, and `examples/cube-color-alternatives/`. All three
turned out to be **WebGL 1**.

### Restructure
Goal: notes that apply to all examples go in one common file, notes that
apply to all quizzes go in one common file, and anything specific to one
example stays with that example.

Decisions (made by the instructor):
1. WebGL version: keep WebGL 2 as the target and **port the three examples
   later**, as a separate task.
2. Delete the nested `.git` folders in each example (none had commits), so
   the parent repo tracks the files.
3. Each example gets a short `CLAUDE.md` (rules, structure, open issues;
   loaded automatically by Claude Code) and a `NOTES.md` (history).
4. Quiz engine: **keep a copy in each quiz for now** (see "Deferred" below).
5. Delete `camera-move/quiz-selfcheck-example/` (an exact copy of the
   cube-grid quiz).
6. Ignore `.idea/` in git. Delete the placeholder `package.json` files, and
   `example-cube.js` and the unused `index.js` from
   cube-color-alternatives.
7. Keep the example folder names as they are (no numbering).
8. The terminology rules (interpolate, not blend; fragment vs. pixel; …)
   apply course-wide.

Where the old notes went:

| Old file | New home |
|---|---|
| `HOW_TO_MAKE_A_NEW_QUIZ.md` (3 identical copies, in each quiz folder) | `notes/quizzes.md`. It now names `examples/cube-grid/quiz-selfcheck/` as the reference quiz and lists each quiz's `REVIEW_KEY`. |
| The how-to's accuracy list | Root `CLAUDE.md`, "Accuracy" (with additions from the cube-grid notes) |
| Terminology rules (cube-color `IMPLEMENTATION.md`) | Root `CLAUDE.md`, "Terminology" |
| Style and testing rules from several notes | Root `CLAUDE.md`, "Style" and "Testing" |
| cube-grid `SESSION_NOTES.md` | Renamed to `NOTES.md` (unchanged apart from a header). Current state is summarized in `CLAUDE.md`. |
| camera-move `SUMMARY.md` | Split: structure, scene, teaching points, and quiz details went to `CLAUDE.md`; student experiments, status, and next steps went to `NOTES.md`. |
| cube-color `IMPLEMENTATION.md` | File table, sync rules, Tab 5 details, and testing went to `CLAUDE.md`; history, resolved questions, and small decisions went to `NOTES.md`. |
| cube-color `PLAN.md` | Copied in full into `NOTES.md` |

Also added: `.gitignore` (`.DS_Store`, `.idea/`). Removed: `common/`,
`notes/conventions.md`, `notes/concepts-roadmap.md` (their purpose is now
covered by the root `CLAUDE.md` and `README.md`).

No code files were changed. Nothing was committed.

### Issues found during the restructure
- The five cube-color `.js` files have comments that refer to
  `example-cube.js`, which was deleted. Listed as an open issue in that
  example's `CLAUDE.md`. (Dropbox version history may still have the file.)
- cube-grid's old notes listed `GRID_SIZE = 1000` and a moved camera as
  open issues. Both were already back to their original values in the code,
  so they were dropped.
- cube-grid's notes describe a scored `quiz/` folder that wasn't copied into
  this repo.

### Deferred
- **Port all three examples to WebGL 2.** Their quizzes and exploration
  notes quote the code, so they must be updated with the port. (Keep the
  GLSL markers; see "shader syntax highlighting" below.)
- **One shared quiz engine** (e.g. `common/quiz-engine/`, so each quiz only
  holds `cards.js` and `explore-notes.js`). The engine files differ between
  quizzes only in a few names (title, `REVIEW_KEY`), so this is feasible,
  but it changes code.
- **Numbering example folders in teaching order** (e.g. `01-cube-grid`).
- A topic roadmap (which example teaches which concept, in what order).

## 2026-10-16: shader syntax highlighting

Question: should shaders move into separate files so students get GLSL
syntax highlighting in their IDE?

Decision (made by the instructor): **keep shaders inline as JavaScript
strings** and mark each one so the IDE highlights it as GLSL.

Why not separate files:
- Real `.glsl` files must be loaded with `fetch()`, which browsers block on
  `file://` URLs. That breaks "open the `.html` by double-clicking", and
  it adds an async step before the shaders, so the program no longer reads
  straight through.
- `<script type="x-shader/...">` tags work on `file://`, but most IDEs don't
  highlight them, and they split the program between HTML and JS.
- Shaders in their own small `.js` files only get highlighting through the
  same marker comments, which work just as well inline. Splitting would
  also complicate the quizzes (which show one program file) and the
  cube-color-alternatives diff checks.

The markers (students use different IDEs, so both go on each shader):
```js
// language=GLSL
const vertexShaderSource = /* glsl */ `
```
`// language=GLSL` is for JetBrains IDEs, and `/* glsl */` is for VS Code
with the "Comment tagged templates" extension. Both need a GLSL plugin.

Changes:
- Trial in `examples/cube-grid/index.js` only (both shaders, plus a note in
  section 1's header).
- `notes/quizzes.md` §7a: `strip` now also removes `/* ... */` comments,
  so the quiz checks ignore the markers.

With WebGL 2, `#version 300 es` must be the first line of the source, so
the string must start right after the backtick: ``/* glsl */ `#version 300 es``.

Outcome: the instructor approved the cube-grid trial. The markers are now
a project-wide rule (root `CLAUDE.md`, "Style for all examples"), to be
added to every example.

Rollout to camera-move and cube-color-alternatives: **done the same day**,
following this plan. All checks passed (details in each example's
`NOTES.md`). The plan, for reference:
- camera-move `index.js`: both markers on its 2 shaders, plus the same
  short note at the end of the shaders header comment. Its quiz copies
  don't change; rerun the `notes/quizzes.md` §7 checks.
- cube-color-alternatives: both markers on all 10 shaders (2 per file),
  plus the same note at the end of section 1's header in all five files.
  Apply it with a small script so the lines are identical in every file,
  then rerun the four neighboring diffs in its `CLAUDE.md`. They should
  show exactly what they showed before.
- Run `node --check` on each file, and open each page through a local
  server to check for console errors.
- Afterwards, update each example's `CLAUDE.md` and `NOTES.md`.

Still open:
- **Not checked in an IDE by a person yet.** The code was checked
  (syntax, quiz checks, diffs, pages load), but nobody has confirmed the
  highlighting itself. Open a shader in VS Code (with "Comment tagged
  templates" plus a GLSL extension) and in a JetBrains IDE (with a GLSL
  plugin). If one marker doesn't work, fix or drop it in the root
  `CLAUDE.md` and in all 12 shader strings.
- The shader comments have terminology problems (noticed, not fixed). See
  the open issues in cube-grid's and camera-move's `CLAUDE.md`. Fix them
  with the WebGL 2 port or the next shader edit.
