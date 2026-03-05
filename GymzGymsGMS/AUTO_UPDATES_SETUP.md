# GMS Auto-Updates Setup

**Configured for:** `supportgymz-stack/GMS` on GitHub (Gym Management System).

## Publish flow

1. Bump `version` in `package.json` (e.g. `1.0.0` → `1.0.1`)
2. Run `npm run electron:build`
3. Create a GitHub Release with tag `v1.0.1` (must match version exactly)
4. Upload `release/GMS Setup X.X.X.exe` and `release/latest.yml` to the release
5. Clients will check for updates on launch and prompt to install

---

## Option 2: Custom Server

If you host updates on your own server:

```json
"build": {
  "publish": {
    "provider": "generic",
    "url": "https://your-domain.com/gms-updates"
  }
}
```

Your server must serve:
- `GMS Setup X.X.X.exe` (installer)
- `latest.yml` (metadata with version, file name, sha512)

---

## Notes

- **Version format:** Use semver (e.g. `1.0.0`). Never reuse a version.
- **Code signing:** For production, sign the installer so Windows doesn’t block updates.
- **Testing:** Test updates on a separate machine before rolling out.
