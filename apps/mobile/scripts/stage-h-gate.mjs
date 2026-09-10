import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const repository = 'khaliflabs/kivocafe';
export const checks = ['dependency_install', 'source_identity', 'typecheck', 'lint', 'tests', 'expo_doctor', 'expo_config', 'security_audit', 'secret_scan', 'expo_export', 'git_integrity', 'backend_dependency_install', 'backend_typecheck', 'backend_lint', 'backend_tests', 'migration_rls_tests', 'backend_security_audit'];
export function validateSha(sha) {
  assert.match(sha ?? '', /^[0-9a-f]{40}$/, 'source_sha must be a full lowercase Git SHA');
}

export function verifyEvidence(sha, workflowId, run, artifact, receipt) {
  validateSha(sha);
  assert.equal(run.repository?.full_name?.toLowerCase(), repository, 'Wrong run repository');
  assert.equal(run.workflow_id, workflowId, 'Wrong workflow ID');
  assert.equal(run.name, 'KIVO Mobile Stage G');
  assert.equal(run.path, '.github/workflows/mobile-stage-g.yml');
  assert.equal(run.event, 'push');
  assert.equal(run.head_branch, 'main');
  assert.equal(run.head_sha, sha);
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success');
  assert.equal(artifact.name, `kivo-mobile-stage-g-${sha}`);
  assert.equal(artifact.expired, false);
  assert.equal(artifact.workflow_run?.id, run.id);
  assert.equal(artifact.workflow_run?.head_sha, sha);
  assert.equal(receipt.schema_version, 1);
  assert.equal(receipt.repository?.toLowerCase(), repository);
  assert.equal(receipt.source_sha, sha);
  assert.equal(receipt.event, 'push');
  assert.equal(receipt.ref, 'refs/heads/main');
  assert.equal(receipt.workflow, 'KIVO Mobile Stage G');
  assert.equal(receipt.run_id, String(run.id));
  assert.equal(receipt.run_attempt, String(run.run_attempt));
  for (const check of checks) assert.equal(receipt.validation?.[check], 'passed', `Missing successful ${check}`);
  return { run_id: String(run.id), run_attempt: String(run.run_attempt), receipt_artifact: artifact.name, artifact_id: String(artifact.id), artifact_digest: artifact.digest ?? null, source_sha: sha };
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
function api(path) { return JSON.parse(gh(['api', `repos/${repository}/${path}`])); }

export function gate(sha) {
  validateSha(sha);
  const workflow = api('actions/workflows/mobile-stage-g.yml');
  assert.equal(workflow.name, 'KIVO Mobile Stage G');
  const runs = api(`actions/workflows/${workflow.id}/runs?event=push&head_sha=${sha}&per_page=100`).workflow_runs;
  const candidates = runs.filter(r => r.head_sha === sha && r.event === 'push' && r.status === 'completed' && r.conclusion === 'success');
  assert.ok(candidates.length, 'No successful Stage G PUSH run for requested SHA');
  const run = api(`actions/runs/${candidates[0].id}`);
  const artifacts = api(`actions/runs/${run.id}/artifacts?per_page=100`).artifacts.filter(a => a.name === `kivo-mobile-stage-g-${sha}` && !a.expired);
  assert.equal(artifacts.length, 1, 'Require exactly one unexpired matching receipt artifact');
  const directory = mkdtempSync(join(tmpdir(), 'kivo-stage-g-proof-'));
  gh(['run', 'download', String(run.id), '--repo', repository, '--name', artifacts[0].name, '--dir', directory]);
  const receipt = JSON.parse(readFileSync(join(directory, 'stage-g-receipt.json'), 'utf8'));
  return verifyEvidence(sha, workflow.id, run, artifacts[0], receipt);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const proof = gate(process.argv[2]);
    if (process.argv[3]) writeFileSync(process.argv[3], `${JSON.stringify(proof, null, 2)}\n`);
    console.log(`Stage G gate: PASS; source=${proof.source_sha}; run=${proof.run_id}; artifact=${proof.artifact_id}`);
  } catch (error) {
    // Do not print gh subprocess output, which can contain authentication context.
    console.error(error.code === 'ERR_ASSERTION' ? error.message : 'Stage G verification failed (API, artifact, or malformed receipt).');
    process.exitCode = 1;
  }
}
