# Sloppy Keyboard

> A keyboard that makes every letter take the scenic route.

## What is this?

Sloppy Keyboard is a Windows Electron app disguised as a Galton board. Keep it
above a browser, click the launch rail, and a ball tumbles through brass pins.
The lowercase letter in its landing bin is typed into the input that already
has focus.

Ten unique letters are available in each volley. Launch as many as 25 balls at
once; their shared letter bank rerolls after the final ball lands.

```text
click -> gravity -> statistically questionable spelling -> keyboard input
```

## Requirements

- Windows 10 or newer
- Node.js and npm for development
- A normal, non-administrator browser or text editor as the typing target

Windows prevents a normal application from injecting input into an elevated
administrator application. Run the browser and Sloppy Keyboard at the same
permission level.

## Run

```bash
npm install
npm start
```

To expose the manual minigame launcher during development:

```bash
npm start -- --debug-minigames
```

Packaged builds accept the same `--debug-minigames` command-line flag. Without
the flag, the launcher is hidden and its dedicated IPC endpoint rejects calls.

Sloppy Keyboard does not take keyboard focus, so clicks leave the previously
active application ready to receive generated keystrokes. Physical keystrokes
remain blocked while the keyboard is open. Use the on-screen minimize and close
buttons in the title bar to control the app.

## Verify

```bash
npm test
npm run typecheck
npm run lint
npm run package
```

## Architecture

- `board-state.ts` owns random letters and volley lifecycle.
- `board-physics.ts` owns Matter.js bodies and landing detection.
- `board-renderer.ts` draws the machine without controlling its behavior.
- `renderer.ts` connects UI, physics, and the restricted preload API.
- `input-service.ts` validates and serializes Windows keyboard output.

Each source file stays below 500 lines so features can be developed in
parallel with fewer overlapping edits.
