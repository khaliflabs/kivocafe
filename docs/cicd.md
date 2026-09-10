# KIVO mobile CI/CD

## Stage G — validation

`KIVO Mobile Stage G` runs for relevant pull requests, relevant pushes to `main`, and manual dispatches. It installs the locked mobile dependencies and validates TypeScript, ESLint, Expo Doctor, the public Expo application identity, high/critical dependency advisories, committed secrets, an iOS Expo export, and Git integrity.

The canonical source identity is a full Git commit SHA. A successful run emits a 30-day `kivo-mobile-stage-g-<FULL_SHA>` artifact containing `stage-g-receipt.json`, which binds that SHA to the repository, GitHub run, toolchain versions, and successful checks. Stage G has read-only repository permission and deploys nothing.

Automated application tests are not yet present. Add a required `npm test` step to Stage G when a test suite is introduced.

## Stage H — internal builds

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
