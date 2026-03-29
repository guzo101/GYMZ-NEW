# GymzWebsite

Public marketing website for Gymz, maintained as an independent web project.

> **Not the same as `gymzandnutrition/`**  
> If you need the **“Gymz Game On”** static build (gymz.app–style), that lives in **`gymzandnutrition/`** — see `gymzandnutrition/README.md`. This folder is a **separate Vite/React codebase**.

## Project Scope

- Public landing pages and marketing content
- Waitlist/contact capture
- Website-only UI and services

This project is intentionally separate from `GymzGymsGMS` (desktop/web admin app).
GMS links to this website via `https://gymz.app`.

## Local Development

```bash
npm install
npm run dev
```

Dev server is configured for **`http://localhost:3000/`** (see `vite.config.ts`). If port 3000 is taken, Vite picks the next free port and prints it in the terminal.

**Important:** This folder is **`GymzWebsite`** (public marketing site). A static server on another port (e.g. **5175** for `gymzandnutrition`) is **not** this app — always use the URL from `npm run dev` in **this** folder.

## Build

```bash
npm run build
npm run preview
```

## Environment Variables

Copy `.env.example` to `.env` and fill in real values.

```bash
cp .env.example .env
```

Never commit production secrets.
