# Universal Links (iOS) and `gymz.app`

[`app.config.js`](../../app.config.js) sets:

```js
associatedDomains: ['applinks:gymz.app'],
```

That tells iOS the app may open **HTTPS** links under `gymz.app` as Universal Links when the OS can verify your site.

## Apple App Site Association (AASA)

Apple requires a hosted file (no `.json` extension in the URL):

- **URL:** `https://gymz.app/.well-known/apple-app-site-association`
- **Or:** `https://gymz.app/apple-app-site-association`

The file must be served with `Content-Type: application/json` (or `application/pkcs7-mime` in some setups). It must include your **Team ID** and **bundle ID** in the `applinks` → `details` → `appIDs` format Apple documents (e.g. `ABCDE12345.com.gym.memberapp`).

Reference: [Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains).

## What the app already handles

[`App.tsx`](../../App.tsx) parses deep links for paths such as `auth/callback` and `reset-password` (tokens in hash or query). Universal Links will deliver the same URLs to the app once AASA verification succeeds.

## Custom URL scheme

The app also uses the scheme **`gymz://`** (see `scheme` in `app.config.js`). Links using that scheme do not depend on AASA but are not universal links.

## Verification

- After deploying AASA, use Apple’s **CDN** / validation tools or open a test `https://gymz.app/...` link on a physical iPhone with the app installed.
- If verification fails, iOS may open the link in Safari instead of the app.
