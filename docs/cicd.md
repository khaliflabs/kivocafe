# KIVO mobile CI/CD

## Stage G — validation

`KIVO Mobile Stage G` runs for relevant pull requests, relevant pushes to `main`, and manual dispatches. It installs the locked mobile dependencies and validates TypeScript, ESLint, Expo Doctor, the public Expo application identity, high/critical dependency advisories, committed secrets, an iOS Expo export, and Git integrity.

The canonical source identity is a full Git commit SHA. A successful run emits a 30-day `kivo-mobile-stage-g-<FULL_SHA>` artifact containing `stage-g-receipt.json`, which binds that SHA to the repository, GitHub run, toolchain versions, and successful checks. Stage G has read-only repository permission and deploys nothing.

Automated application tests are not yet present. Add a required `npm test` step to Stage G when a test suite is introduced.

## Future Stage H contract

Stage H is not configured. It must accept a full source SHA and require a successful **push** run of `KIVO Mobile Stage G` for that exact SHA. Its future scope is an EAS internal build, exact source/build identity verification, a build receipt, and an internal distribution artifact—never an implicit production submission.
