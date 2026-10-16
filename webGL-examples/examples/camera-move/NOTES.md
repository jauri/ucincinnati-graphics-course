# Camera orbit: notes

Development history and extra material for this example. Current rules,
structure, and quiz details are in `CLAUDE.md` next to this file. (This file
was split from the original `SUMMARY.md` on 2026-10-16. `package.json`
and the `quiz-selfcheck-example/` reference copy of the cube-grid
quiz were removed then.)

## Goal

A minimal teaching example for an intro computer graphics course. Plain
WebGL with no libraries, no build step, and no frameworks. Every line is
commented so that students who are new to WebGL can follow along.

## Easy experiments for students

The constants near the top of Step 7 are the easiest place to start:

- Change `ORBIT_RADIUS`, `ORBIT_HEIGHT`, or `ORBIT_SPEED`.
- Make the height vary over time, for example
  `ORBIT_HEIGHT + 2 * Math.sin(seconds)`, so the camera bobs up and down.
- Change `LOOK_AT` so the camera aims at a different object.
- Change the field of view, for example from 45° to 90° or 20°, to see a
  wide-angle lens versus a zoomed-in lens.
- Add a new object by adding one line to `sceneObjects`.
- Comment out `gl.enable(gl.DEPTH_TEST)` to see what goes wrong without it.

## Self-check quiz

Built with the same engine as the cube-grid quiz (`notes/quizzes.md`
describes the process and the check scripts). Details are in `CLAUDE.md`.

## Status

- [x] `index.html` and `index.js` written and fully commented.
- [x] Tested in Chrome: the scene renders correctly, the camera orbits
      smoothly, and there are no console errors.
- [x] Summary written (now split into `CLAUDE.md` and this file).

Possible next steps, if wanted: let the user control the camera with the
mouse or keyboard, add lighting with normals, or show orthographic and
perspective projection side by side.

## 2026-10-16: GLSL highlighting markers

Added `// language=GLSL` above and `/* glsl */` before the backtick of
every shader string, plus a short note about them in the shaders header
comment. This is the project-wide rule now (root `CLAUDE.md`; why: see
`notes/NOTES.md`, "shader syntax highlighting"). Comments only; the
program is unchanged.

Checked: `node --check`; the `notes/quizzes.md` §7 checks still pass with
the updated `strip` (14 cards; exploration code matches `index.js`, 173
lines, 0 differences), so the quiz files weren't changed; the page links
its program with no console errors.
