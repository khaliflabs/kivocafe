# KIVO mobile CI/CD

## Stage G — validation

`KIVO Mobile Stage G` runs for relevant pull requests, relevant pushes to `main`, and manual dispatches. It installs the locked mobile dependencies and validates TypeScript, ESLint, Expo Doctor, the public Expo application identity, high/critical dependency advisories, committed secrets, an iOS Expo export, and Git integrity.

The canonical source identity is a full Git commit SHA. A successful run emits a 30-day `kivo-mobile-stage-g-<FULL_SHA>` artifact containing `stage-g-receipt.json`, which binds that SHA to the repository, GitHub run, toolchain versions, and successful checks. Stage G has read-only repository permission and deploys nothing.

`npm test` is mandatory in Stage G: lightweight Node tests cover menu integrity, exact GBP prices, variants, lookup, search, quantity arithmetic, local draft behavior, and Stage H provenance guards. The receipt records `tests: passed`. UI/device acceptance remains manual.

## KIVO 0.2 — local menu

The menu contains 49 products in 11 categories, sourced from the supplied printed-menu prices. `src/menu` centralizes types, data, image references, price/search logic and a session-only React context draft. Product routes are `app/product/[id].tsx`; unknown IDs show a safe menu return. The Orders tab shows only a local draft, not order history or a submitted order. There is no backend, checkout or payment. Unconfirmed sauce options remain empty and explicitly marked as coming soon. Ten local reference photographs are credited in `apps/mobile/assets/products/ATTRIBUTION.md` and labelled as representative in the UI; they are not KIVO photographs.

## iOS development preview — Expo Go

Flow: clean Stage G-approved source SHA → Expo Go → visual/manual testing. Expo Go is a development preview, not an EAS build, TestFlight release, or Stage H release artifact.

Before each review, fetch `origin/main`, confirm the working tree is clean and `HEAD` equals `origin/main`, and verify a successful Stage G PUSH and receipt for that exact SHA. The existing gate can verify this without invoking EAS: from `apps/mobile`, run `node scripts/stage-h-gate.mjs "$(git rev-parse HEAD)"`; it requires GitHub CLI read access to KIVO Actions/artifacts. If proof is missing, stop. Any source edit invalidates the approved preview until committed and revalidated by Stage G.

After `npm ci`, `npm run lint`, `npm run typecheck`, and `npx expo-doctor` pass, start as the `kivo` user:

```bash
cd /home/kivo/projects/kivocafe/apps/mobile
npm run start:go:tunnel:headless
```

The remote tools server is not on the iPhone's LAN, so use Expo's tunnel; no inbound firewall or SSH changes are needed. The tools server has the official helper installed outside application dependencies with `npm install --global @expo/ngrok@4.1.3` (one-time server setup). Keep the terminal open, or run inside `tmux new -s kivo-expo-go`; reattach with `tmux attach -t kivo-expo-go`. Stop with Ctrl+C when review is finished. Tunnel addresses can change after restart and should be shared only with reviewers; never run the preview with Doppler secrets injected.

The Linux-only headless script uses Expo SDK 57's `EXPO_UNSTABLE_HEADLESS=1` setting to avoid starting desktop React Native DevTools on this server; it does not disable the browser sandbox. It also hides Expo's interactive QR UI. In a second terminal, from `apps/mobile`, print the current QR using the installed Expo CLI helper (no extra dependency):

```bash
node <<'NODE'
const { join, dirname } = require('node:path');
const cliQR = join(dirname(require.resolve('expo/package.json')), 'node_modules/@expo/cli/build/src/utils/qr.js');
fetch('http://127.0.0.1:8081/', { headers: { 'expo-platform': 'ios', accept: 'application/expo+json' } })
  .then(response => response.json())
  .then(manifest => {
    const url = `exp://${new URL(manifest.launchAsset.url).host}`;
    console.log(url);
    require(cliQR).printQRCode(url).print();
  }).catch(() => { console.error('Start the Expo Go tunnel first.'); process.exitCode = 1; });
NODE
```

The QR helper path is verified against this project's locked SDK 57 CLI. On a workstation with desktop support, `npm run start:go:tunnel` retains the normal interactive QR interface.

Install/update Expo Go on the iPhone and sign in with the same Expo account as the CLI (`khalif27`; verify with `npx expo whoami`). The App Store Expo Go supports SDK 57 and requires matching CLI/app login; see [Expo's SDK 57 login notice](https://expo.dev/changelog/expo-go-57-login). Scan the terminal QR using the iPhone Camera and open Expo Go. Review the KIVO wordmark, cream/espresso/gold styling, Home, Menu, Orders, Rewards, and Profile. App icon/native splash configuration is not faithfully represented by Expo Go; native identity/signing remains an EAS-build concern.

`npm run start:go` uses the default connection mode; `npm run start:go:lan` is only for devices that can actually reach the server on a trusted LAN. No custom development client or extra application dependency is needed for the current UI.

## Stage H — internal builds

Current status: an Android `preview` internal build has succeeded with verified source identity. Signed iOS Stage H builds are intentionally deferred until Apple Developer signing is ready. Expo Go review does not remove that prerequisite or produce a combined Stage H success receipt.

Manually dispatch `KIVO Mobile Stage H` from `main` with a full lowercase 40-character `source_sha` and `platform` (`all`, `android`, or `ios`). Stage H verifies a completed successful Stage G **push to main** for that SHA and downloads the matching unexpired receipt. Repository, workflow ID/path, run ID/attempt, artifact identity, source SHA, and every mandatory validation must match. A missing or expired receipt blocks builds; rerun Stage G for the source if needed.

Flow: exact source SHA → successful Stage G PUSH → receipt verification → exact source checkout → `mobile-internal` → `DOPPLER_TOKEN` → Doppler `kivo/stg` → transient `EXPO_TOKEN` → EAS `preview` internal build → verified Stage H receipt → acceptance testing.

The controller comes from the dispatched workflow commit, independently of the requested build source. The source checkout must be clean. Stage H uses Node 22 and `npx --yes eas-cli@24.0.0`; EAS CLI is intentionally isolated from application dependencies. Stage G covers all workflow changes. Controller tests run with `node --test scripts/stage-h.test.mjs` from `apps/mobile`.

### Secrets and boundaries

The GitHub Environment `mobile-internal` stores only `DOPPLER_TOKEN`, for the read-only `kivo-stage-h` service token scoped to `kivo/stg`. `EXPO_TOKEN` remains in Doppler. There is no OIDC, secret sync, direct GitHub Expo token, or local credential fallback. The controller uses the official Doppler v3 API to check service-token scope and fetch only `EXPO_TOKEN` in memory, masks it in GitHub logs, and passes it only to EAS subprocesses. It does not write a secret dump or fallback file. The Doppler/GitHub tokens are removed from the EAS subprocess environment. No request targets Jazari, `kivo/dev`, or `kivo/prd`.

The expected Expo identity is `@khalif27s-team/kivo-cafe`, project `90aaa97b-231b-4ba9-84a6-77407df18c26`, with `com.khaliflabs.kivocafe` for both native identifiers. The fixed `preview` profile uses internal distribution and an Android APK. `development` is an internal baseline; it is not a dev-client profile until `expo-dev-client` is intentionally added. The reserved production profile has no submission automation.

Stage H fails before EAS on missing credentials, rejected Doppler scope, failed Stage G proof, or application identity mismatch. Signing prerequisites may require interactive EAS setup: Android needs an EAS-managed keystore; iOS device builds need Apple Developer signing credentials and registered devices. CI never bypasses signing or submits to stores.

Both requested builds must finish. Stage H re-queries each EAS ID and requires its Git commit, project, owner, identifiers, profile, distribution, platform, and artifact to match. Only then is `stage-h-receipt.json` uploaded as `kivo-mobile-stage-h-<FULL_SHA>` for 90 days. It records Stage G/H run identities, Doppler project/config, Expo identity, build IDs/versions, and internal artifact links; it contains no credentials. A partial/failed build produces no success receipt. GitHub cancellation can leave a remote EAS build running; inspect its build ID before deciding whether to cancel or retry.

Official references: [Doppler Service Tokens](https://docs.doppler.com/docs/service-tokens), [token identity API](https://docs.doppler.com/reference/auth-me), [filtered secrets API](https://docs.doppler.com/reference/secrets-download), and [EAS internal distribution](https://docs.expo.dev/build/internal-distribution/).

The controller pins the audited service token's non-secret ID (`2fb770f0-d12b-46ff-ade1-7993b0441925`) and verifies its default project/config through Doppler. Rotation requires auditing the replacement token's read-only `kivo/stg` scope, updating this ID in the controller, and replacing the GitHub Environment secret. A token value is never committed.

## Future Stage I contract

Stage I must take a verified Stage H build identity and require explicit approval to promote or submit that identified build. It must not silently rebuild different source. Stage I and production submission are not implemented.
