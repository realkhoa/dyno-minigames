# Dyno MiniGames

A tiny shelf of daily logic mini games, served as a static site on GitHub Pages.
The dashboard is the home screen; each game lives on its own hash route so the
build works from any repository path without server rewrites.

**Live game: Tango** — balance suns and moons on a 6×6 grid.

![Dashboard](docs/dashboard.png)

![Tango](docs/tango.png)

## Play

| Action | How |
| --- | --- |
| Place / cycle a symbol | Click or tap a cell (empty → sun → moon → empty) |
| Clear a cell | Right-click, or focus it and press `0` / `Backspace` |
| Keyboard | Arrow keys move, `1`/`S` = sun, `2`/`M` = moon |
| Restart | Toolbar button |

Progress and the timer are saved in `localStorage`, per puzzle. The daily puzzle
is keyed by the local date; practice puzzles get a random seed.

## Tango rules

- Fill every cell with a **sun** or a **moon**.
- Every row and column holds exactly **three suns and three moons**.
- Never three identical symbols in a row or column.
- `=` links force two neighbours to match; `×` links force them to differ.
- Grey cells with a dot are **locked clues** — they cannot be edited.
- Any grid that satisfies all rules wins.

## Puzzle generation & difficulty

Puzzles are generated in the browser from a deterministic seed
(`mulberry32` + a string hash), so the daily puzzle is identical for everyone
without a backend.

1. Build a random full grid that satisfies the rules.
2. Attach random `=` / `×` links consistent with that grid.
3. Remove clues one at a time, keeping a removal only while the number of valid
   completions stays inside the difficulty band. Every kept removal is verified
   with a backtracking solver (`countSolutions`), and the final puzzle is
   re-counted before it is returned. A stored solution always exists, so a
   puzzle can never be unsolvable.

Difficulty is defined by how many valid completions remain — higher is stricter:

| Difficulty | Solutions | Links |
| --- | --- | --- |
| Easy | 6–14 | ~3 |
| Medium | 4–5 | ~5 |
| Hard | 2–3 | ~7 |
| **Deadly** | **exactly 1** | ~9 |

The daily puzzle is **Deadly**: guaranteed unique. Because every puzzle keeps at
least three locked clues, no puzzle can be solved by editing cells that were
meant to be fixed.

Generation costs ~1–3 ms per puzzle on a laptop; the engine is unit-tested in
`scripts/tango.test.ts` (uniqueness, bands, deterministic seeds, conflicting-cell
detection).

## Stack

Vite 8 + React 19 + TypeScript. No runtime dependencies beyond React. Hash
routing keeps GitHub Pages happy. CSS is hand-written; no UI kit.

```
src/
  games/tango/engine.ts     puzzle rules, solver, generator, difficulty bands
  games/tango/TangoGame.tsx game screen
  pages/Dashboard.tsx       game shelf
  components/               icons + modal
  lib/                      hash router, storage helpers
scripts/
  tango.test.ts             engine checks
  ui-check.ts               headless Chrome end-to-end checks
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

1. Create a repository and push this project to `main`.
2. In **Settings → Pages → Build and deployment**, set **Source** to
   **GitHub Actions**.
3. Push again (or run the workflow manually). The site appears at
   `https://<user>.github.io/<repo>/`.

`vite.config.ts` uses `base: "./"`, so the same build works for a project page,
a user page, or a custom domain without editing the repo name.

```bash
git init
git add .
git commit -m "feat: Tango MVP dashboard"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

## Roadmap

- Queens, Pinpoint, Crossclimb (cards already on the dashboard).
- Per-game stats and streaks on the dashboard.

---

### Tiếng Việt

- `npm install` → `npm run dev` để chạy local, `npm run build` để tạo bản tĩnh.
- Đẩy code lên GitHub, vào **Settings → Pages**, chọn **Source: GitHub Actions**;
  workflow có sẵn sẽ tự build và deploy.
- Đề Tango được sinh ngay trên trình duyệt theo seed (ngày cho puzzle daily),
  nên không cần server. Độ khó quyết định bởi số lời giải: Easy nhiều lời giải,
  Medium 4–5, Hard 2–3, **Deadly đúng 1 lời giải**. Mọi đề đều giữ tối thiểu 3 ô
  khoá không sửa được và luôn có ít nhất một lời giải hợp lệ.
