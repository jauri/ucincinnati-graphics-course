# Example: cube grid

Draws a grid of cubes with random heights and colors from a fixed camera,
with simple diffuse lighting. It's drawn once, and again on resize (no
animation). WebGL 1 for now (see the root `CLAUDE.md`). History is in
`NOTES.md`.

## Files
- `index.html`: a full-window `<canvas id="c">` that loads `index.js`.
- `index.js`: the whole program, in numbered sections:
  0. Get the WebGL context
  1. Shaders (vertex + fragment, compile, link). Both shader strings carry
     the GLSL markers (`// language=GLSL`, `/* glsl */`; see the root
     `CLAUDE.md`).
  2. Cube geometry → buffer, attribute layout, uniform locations
  3. The scene (plain JS list of cubes)
  4. Matrix helpers (`translation`, `scaling`, `multiply`, `perspective`, `lookAt`)
  5. Draw
- `quiz-selfcheck/`: the self-check quiz. This is the **reference quiz**
  that `notes/quizzes.md` tells new quizzes to copy.

## Quiz
- 12 cards in pipeline order: vertex shader, fragment shader, compile/link,
  cube vertex data, creating the buffer, buffer layout (attributes),
  uniform locations, model matrix, perspective, lookAt camera, preparing a
  frame, draw loop. 5 questions per card.
- Exploration page: 16 sections; 137 of 204 lines have a note.
- `REVIEW_KEY` is `webglQuizReview`.
- `cards.js` and `explore-notes.js` are **copies** of `index.js` code. If
  `index.js` changes, update them by hand and rerun the checks in
  `notes/quizzes.md`.
- The quiz was written for students who haven't seen homogeneous
  coordinates (card 1, question 4 avoids the term). Add it back if the
  course has covered it.

## Open issues
- The line numbers below are out of date: the 2026-10-16 GLSL markers
  moved them. `aNormal` is now line 55. The instructor hasn't decided yet
  whether to update the numbers or describe the lines by their content.
- Fragment shader comment (line 84): "The GPU blends vNormal" and
  "EVERY PIXEL" break the terminology rules ("the rasterizer
  interpolates", "fragment").
- `index.js` line 50: the `aNormal` comment still says "direction the face
  is pointing". The quiz was corrected to per-vertex normals; `index.js`
  wasn't.
- Not checked by a person yet: the wording of the 60 questions and the
  exploration notes, and drag-and-drop in the matching step (by hand).

## Ideas, not requested yet
- Shuffle card order on "Try again".
- Add animation (`requestAnimationFrame`) or rotation as a follow-up; the
  vertex shader's normal transform would then matter.
