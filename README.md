# foodtracker

Browser-based food tracker. Static site, localStorage-backed, no backend.

**Status:** see [specs/STATUS.md](./specs/STATUS.md). **Plan:** see [specs/MILESTONES.md](./specs/MILESTONES.md).

## Stack

TypeScript, Vite, Web Test Runner + Playwright. Deployed to GitHub Pages.

## Local dev

_(commands land in M0 — this section will update once the scaffold ships)_

```bash
npm install
npx playwright install chromium
npm run dev       # localhost:5173
npm run build     # → dist/
npm test
```

## License

MIT. See [LICENSE](./LICENSE).
