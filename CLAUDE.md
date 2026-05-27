# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Single-file HTML/CSS/JS browser game. No build step, no dependencies, no package manager. Open `tictactoe.html` directly in a browser to run it.

## Architecture

Everything lives in `tictactoe.html` in three inline sections:

- **`<style>`** — all visual styling; dark theme with CSS custom colour values (`#1a1a2e`, `#16213e`, `#0f3460`, `#e94560`, `#a8dadc`)
- **`<body>`** — static HTML scaffold: `#board` (9 `.cell` divs with `data-i` indices 0–8), `#status`, `#scores`, and a reset button
- **`<script>`** — all game logic:
  - `WINS` — the 8 winning index triples, checked on every move
  - `board` — flat 9-element array, source of truth for game state
  - `checkWinner()` — returns `{ winner, line }` on win, `{ winner: null }` on draw, `null` if game continues
  - `handleClick()` — mutates `board`, updates DOM, calls `checkWinner()`
  - `init()` — resets board array and all DOM state; called on load and "New Game"

## Git workflow

**After every change, no exceptions:** stage the affected files, commit with a clean descriptive message, and push to `origin main`. Never leave work uncommitted — every saved state must exist on GitHub so progress is never lost and any change can be reverted.

```bash
git add <file>
git commit -m "Short imperative summary of what changed"
git push
```

Commit message rules:
- Imperative mood, present tense ("Add", "Fix", "Update", not "Added" or "Adding")
- First line ≤ 72 characters, describes *what* changed
- No vague messages like "update" or "fix stuff"

Remote: https://github.com/BastianBertram/tic-tac-toe
