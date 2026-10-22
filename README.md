# Dyno MiniGames

**Live:** https://realkhoa.github.io/dyno-minigames/

A tiny shelf of daily logic mini games in the LinkedIn style, served as a static
site on GitHub Pages. The dashboard is the home screen; each game lives on its
own hash route so the build works from any repository path without server
rewrites.

![Dashboard](docs/dashboard.png)

## Games

| Game | Status | Idea |
| --- | --- | --- |
| **Tango** | live | Balance suns and moons on a 6×6 grid |
| **Queens** | live | One queen per row, column and colour region |
| Zip | planned | One path through every cell, numbers in order |
| Mini Sudoku | planned | 6×6 sudoku with 2×3 boxes |
| Crossclimb | planned | Word ladder with clues |
| Pinpoint | planned | Five clues, one category |
| Patches | planned | Rectangles sized by area clues |
| Wend | planned | Winding word paths covering every letter |

![Tango](docs/tango.png)

![Queens](docs/queens.png)

## Tango

- Fill every cell with a **sun** or a **moon**.
- Every row and column holds exactly **three suns and three moons**.
- Never three identical symbols in a row or column.
- `=` links force two neighbours to match; `×` links force them to differ.
- Cells with a lock are **fixed clues** and cannot be edited.
- Any grid that satisfies all rules wins.

## Queens

- Place exactly *N* queens on an *N*×*N* board.
- One queen per row, per column, and per coloured region.
- Queens may never touch — not even diagonally.
- There are no pre-filled clues: the region map is the whole puzzle.
- Use the **Mark** tool (or right-click) to note cells you have ruled out.
- Any valid arrangement wins; the header shows how many exist.

## Controls

| Action | How |
| --- | --- |
| Place / cycle | Click or tap a cell |
| Clear | Right-click, or `0` / `Backspace` |
| Keyboard | Arrow keys move, `1`/`S` places, `2`/`M` marks |
| Restart | Toolbar button |

Progress and the timer are saved in `localStorage`, per puzzle. Daily puzzles are
keyed by the local date; practice puzzles get a random seed and a fresh board.

## Puzzle generation

Every board is generated in the browser from a deterministic seed
(`mulberry32` + string hash), so a daily puzzle is identical for everyone with no
backend, and any seed reproduces the same board.

**Tango** — build a valid full grid, attach `=` / `×` links, then remove clues
one at a time while the number of completions stays inside the difficulty band.
The final count is verified with a backtracking solver, and the stored solution
always exists, so a puzzle can never be unsolvable.

| Difficulty | Solutions | Links |
| --- | --- | --- |
| Easy | 6–14 | ~3 |
| Medium | 4–5 | ~5 |
| Hard | 2–3 | ~7 |
| **Deadly** | **exactly 1** | ~9 |

**Queens** — place a random legal queen set, grow one connected region per queen
by random expansion, then keep the tightest board found across ~180 attempts
(early exit on a unique solution). Random, crooked regions constrain the solver
far more than tidy balanced blobs.

| Difficulty | Board | Typical solutions |
| --- | --- | --- |
| Easy | 6×6 | 1 (always unique in testing) |
| Medium | 7×7 | 1–3 |
| Hard | 8×8 | 1–6 |
| **Deadly** | 9×9 | 1–21 |

Generation costs ~3 ms (6×6) to ~65 ms (9×9) per board on a laptop. Engine tests
live in `scripts/tango.test.ts` and `scripts/queens.test.ts` and run with
`npm test`.

## Stack

Vite 8 + React 19 + TypeScript. No runtime dependencies beyond React. Hash
routing keeps GitHub Pages happy. CSS is hand-written; no UI kit.

```
src/
  games/tango/engine.ts      rules, solver, generator, difficulty bands
  games/tango/TangoGame.tsx  game screen
  games/queens/engine.ts     placement solver, region growth, generator
  games/queens/QueensGame.tsx
  components/GameShell.tsx   shared game chrome (header, help, layout, footer)
  components/                icons + modal
  pages/Dashboard.tsx        game shelf
  lib/                       seeded random, hash router, storage helpers
scripts/
  tango.test.ts, queens.test.ts   engine checks
  ui-check.ts                     headless Chrome end-to-end checks
```

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm test           # engine tests (Node 22+)
```

The UI check needs a running preview server plus Chrome:

```bash
npm run preview -- --port 4173
node --experimental-strip-types scripts/ui-check.ts
```

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and publishes `dist/` on
every push to `main`.

1. In **Settings → Pages → Build and deployment**, set **Source** to
   **GitHub Actions**.
2. Push to `main`. The site appears at `https://<user>.github.io/<repo>/`.

`vite.config.ts` uses `base: "./"`, so the same build works for a project page, a
user page, or a custom domain without editing the repo name.

## Roadmap

- Zip, Mini Sudoku, Crossclimb, Pinpoint, Patches, Wend.
- Per-game stats and streaks on the dashboard.

---

### Tiếng Việt

- `npm install` → `npm run dev` chạy local, `npm run build` tạo bản tĩnh.
- Đẩy code lên GitHub, vào **Settings → Pages**, chọn **Source: GitHub Actions**;
  workflow có sẵn sẽ tự build và deploy.
- Đề được sinh ngay trên trình duyệt theo seed (ngày cho puzzle daily), không
  cần server.
- **Tango**: độ khó theo số lời giải — Easy nhiều lời giải, Medium 4–5, Hard 2–3,
  **Deadly đúng 1 lời giải**; luôn có tối thiểu 3 ô khoá không sửa được.
- **Queens**: đặt N quân hậu trên bàn N×N, mỗi hàng/cột/vùng màu đúng một quân,
  không quân nào chạm nhau kể cả chéo. Vùng màu là toàn bộ đề bài.
