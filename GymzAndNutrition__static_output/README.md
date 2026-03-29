# gymzandnutrition (primary marketing site — static build)

**Facts (verified in this repo):**

- This folder is a **built static site**: `index.html` + `assets/*.js` + `assets/*.css` (no `package.json` in this folder).
- Page title in `index.html`: **“Gymz Game On”** — this is the site aligned with **gymz.app**-style positioning.
- **Not the same project as `GymzWebsite/`** (that is a separate Vite/React source tree).

## Run locally (port 3000)

From the **repository root** (`Cursor/`):

```bash
npx --yes serve gymzandnutrition -l 3000
```

Open **http://localhost:3000/**

If port 3000 is in use, pick another port, e.g. `-l 3001`, and use the URL the tool prints.
