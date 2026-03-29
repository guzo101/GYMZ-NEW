# Logo File Instructions

The application is configured to use a single logo source of truth located at:
**`/image_assets/gymzLogo.png`**

During development/build, the build scripts copy it to:
- **`/public/gymzLogo.png`** (for the web UI / Vite)
- **`/build/icon.png`** + **`/build/icon.ico`** (for Electron/Windows packaging)

## To add your logo

1. Place your logo image file in `image_assets/`
2. Name it `gymzLogo.png` (512x512 recommended)
3. Run: `node scripts/copy-gymz-icon.cjs` (or `npm run electron:build:verify`)

The logo will automatically appear in all locations where the `GymzLogo` component is used:

- AppSidebar
- MemberSidebar  
- Login pages
- Website header and footer
- All other locations using the logo component
