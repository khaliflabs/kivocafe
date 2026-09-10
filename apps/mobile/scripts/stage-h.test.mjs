import assert from 'node:assert/strict';
import test from 'node:test';
import { checks, validateSha, verifyEvidence } from './stage-h-gate.mjs';
import { projectId, verifyBuild, verifyConfig } from './stage-h-build.mjs';

const sha = '4dc345b6e860f263e1a3e48461a5ecff4731989f';
function evidence() {
  return {
    run: { id: 123, run_attempt: 1, repository: { full_name: 'KhalifLabs/kivocafe' }, workflow_id: 42, name: 'KIVO Mobile Stage G', path: '.github/workflows/mobile-stage-g.yml', event: 'push', head_branch: 'main', head_sha: sha, status: 'completed', conclusion: 'success' },
    artifact: { id: 456, name: `kivo-mobile-stage-g-${sha}`, expired: false, workflow_run: { id: 123, head_sha: sha } },
    receipt: { schema_version: 1, repository: 'khaliflabs/kivocafe', source_sha: sha, event: 'push', ref: 'refs/heads/main', workflow: 'KIVO Mobile Stage G', run_id: '123', run_attempt: '1', validation: Object.fromEntries(checks.map(key => [key, 'passed'])) },
  };
}
test('valid Stage G evidence preserves source and artifact identities', () => {
  const { run, artifact, receipt } = evidence();
  assert.equal(verifyEvidence(sha, 42, run, artifact, receipt).artifact_id, '456');
});
for (const input of ['main', 'latest', sha.slice(0, 7), sha.toUpperCase(), `${sha}\n`]) {
  test(`reject invalid SHA ${JSON.stringify(input)}`, () => assert.throws(() => validateSha(input)));
}
const changes = {
  'PR-only run': e => { e.run.event = 'pull_request'; },
  'wrong source': e => { e.run.head_sha = '0'.repeat(40); },
  'failed run': e => { e.run.conclusion = 'failure'; },
  'cancelled run': e => { e.run.conclusion = 'cancelled'; },
  'incomplete run': e => { e.run.status = 'in_progress'; },
  'wrong repository': e => { e.run.repository.full_name = 'other/repo'; },
  'wrong workflow': e => { e.run.workflow_id = 43; },
  'wrong branch': e => { e.run.head_branch = 'feature'; },
  'expired artifact': e => { e.artifact.expired = true; },
  'wrong artifact run': e => { e.artifact.workflow_run.id = 999; },
  'wrong receipt SHA': e => { e.receipt.source_sha = '0'.repeat(40); },
  'wrong receipt repository': e => { e.receipt.repository = 'other/repo'; },
  'wrong receipt run': e => { e.receipt.run_id = '999'; },
  'stale attempt receipt': e => { e.receipt.run_attempt = '2'; },
  'missing validation': e => { delete e.receipt.validation.secret_scan; },
  'missing menu tests': e => { delete e.receipt.validation.tests; },
  'failed validation': e => { e.receipt.validation.expo_export = 'failed'; },
};
for (const [name, change] of Object.entries(changes)) {
  test(`fail closed: ${name}`, () => {
    const e = evidence(); change(e);
    assert.throws(() => verifyEvidence(sha, 42, e.run, e.artifact, e.receipt));
  });
}
function build() {
  return { id: projectId, status: 'FINISHED', platform: 'ANDROID', gitCommitHash: sha, app: { id: projectId, ownerAccount: { name: 'khalif27s-team' }, slug: 'kivo-cafe' }, appIdentifier: 'com.khaliflabs.kivocafe', buildProfile: 'preview', distribution: 'INTERNAL', appVersion: '1.0.0', appBuildVersion: '1', artifacts: { buildUrl: 'https://expo.dev/test.apk' } };
}
test('verified EAS result projects only receipt fields', () => {
  const b = build(); b.logFiles = ['omitted'];
  assert.equal(verifyBuild(b, sha, 'android').version_code, '1');
  assert.equal(verifyBuild(b, sha, 'android').logFiles, undefined);
});
for (const [key, value] of [['status', 'ERRORED'], ['gitCommitHash', '0'.repeat(40)], ['buildProfile', 'production'], ['distribution', 'STORE'], ['platform', 'IOS']]) {
  test(`reject EAS ${key} mismatch`, () => { const b = build(); b[key] = value; assert.throws(() => verifyBuild(b, sha, 'android')); });
}
test('reject unrelated EAS project', () => { const b = build(); b.app.id = 'other'; assert.throws(() => verifyBuild(b, sha, 'android')); });
test('reject missing build artifact', () => { const b = build(); b.artifacts = {}; assert.throws(() => verifyBuild(b, sha, 'android')); });
test('reject missing app configuration', () => assert.throws(() => verifyConfig({}, {})));
