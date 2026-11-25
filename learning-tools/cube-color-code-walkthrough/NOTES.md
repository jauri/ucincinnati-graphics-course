# Cube color code walkthrough: notes

## 2026-11-25: built

Request: a learning activity that walks through the code, highlighting
one section at a time and explaining it in words and pictures, with Prev
/ Next and a way to jump to other sections, without overwhelming
students with the whole file.

Decisions, asked in a dialog:
- Program: tabs 5 (custom interpolation) and 6 (per-triangle rules).
- Code view: "depends on the file and how to divide things into separate
  functions/actions". So each step is one function or action, and
  everything else is folded.
- Pictures: a diagram for each step, plus a live cube set up for each
  step (always the real, finished program, not "built so far").
- Jumping: a section list with step dots.
- Tab 6: a switch like the explorer's, with each step showing that tab's
  code. Lines that changed from tab 5 are marked, and the two tab-6-only
  steps sit where they belong in the file.
- Rules: three steps (rule 0 alone, rules 1–4 with a picker, animated
  rules 5–7 with a picker).
- Interaction: reading only (no questions).

Built: index.html, index.js, generated tab5/tab6 sources, CLAUDE.md,
this file. Linked from the root index.html and README.md.
