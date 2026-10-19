# Claude instructions: learning tools

Interactive tools for a university computer graphics course. Each tool
lives in its own folder, with its own `CLAUDE.md` (rules and current
state) and `NOTES.md` (development history).

## Working rules
- Always ask before creating, editing, or deleting files. Propose first,
  then wait for approval.
- Don't fix problems in a tool unless asked. Mention them instead.
- New tools need a link in the repo's root `index.html` (the GitHub Pages
  landing page) and a row in `README.md`.

## Style for all tools
- Plain JavaScript and the Canvas 2D API (or WebGL 2 if a tool needs 3D;
  then follow `../webGL-examples/CLAUDE.md`). No libraries, no build step,
  no ES modules, no web server needed. Students open `index.html` by
  double-clicking it.
- Compute the math by hand so students can read it (e.g. evaluate a
  Bézier curve instead of calling `bezierCurveTo`).
- One `index.html` (layout and controls) and one `index.js` (the program),
  in numbered sections a student can read top to bottom.
- Comment heavily: a header comment per section explaining what and why,
  plus line-by-line comments where useful.
- Wording: plain and direct. Use the standard technical term once the
  course has taught it.
- Handle high-DPI screens: drawing-buffer size = CSS size ×
  `window.devicePixelRatio`, then scale the context.

## Testing
- Syntax check: `node --check index.js`.
- Claude in Chrome cannot open `file://` URLs. Serve the folder
  temporarily (`python3 -m http.server 8765 --bind 127.0.0.1`), open the
  page, check the console for errors, then stop the server.
- Automated mouse drags may not behave like real ones. Ask the instructor
  to try dragging by hand.
