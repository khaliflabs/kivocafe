import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { repository, validateSha } from './stage-h-gate.mjs';

export const projectId = '90aaa97b-231b-4ba9-84a6-77407df18c26';
const owner = 'khalif27s-team';
const slug = 'kivo-cafe';
const identifier = 'com.khaliflabs.kivocafe';

export function verifyConfig(config, eas) {
  assert.equal(config.owner, owner);
  assert.equal(config.slug, slug);
  assert.equal(config.extra?.eas?.projectId, projectId);
  assert.equal(config.ios?.bundleIdentifier, identifier);
  assert.equal(config.android?.package, identifier);
  assert.equal(eas.cli?.version, '24.0.0');
  assert.equal(eas.cli?.appVersionSource, 'local');
  assert.equal(eas.build?.preview?.distribution, 'internal');
  assert.equal(eas.build?.preview?.environment, 'preview');
  assert.equal(eas.build?.preview?.android?.buildType, 'apk');
  assert.ok(!eas.build.preview.extends && !eas.build.preview.env && !eas.build.preview.autoIncrement);
  assert.ok(!eas.build.preview.ios?.simulator, 'Stage H requires an iOS device build');
  assert.ok(!eas.submit, 'Stage H does not configure submission');
}

export function verifyBuild(build, sha, platform) {
  assert.match(build.id ?? '', /^[0-9a-f-]{36}$/);
  assert.equal(build.status, 'FINISHED');
  assert.equal(build.platform, platform.toUpperCase());
  assert.equal(build.gitCommitHash, sha);
  assert.equal(build.app?.id, projectId);
  assert.equal(build.app?.ownerAccount?.name, owner);
  assert.equal(build.app?.slug, slug);
  assert.equal(build.appIdentifier, identifier);
  assert.equal(build.buildProfile, 'preview');
  assert.equal(build.distribution, 'INTERNAL');
  assert.ok(!build.isForIosSimulator);
  assert.ok(build.appVersion && build.appBuildVersion);
  const artifact = build.artifacts?.applicationArchiveUrl ?? build.artifacts?.buildUrl;
  assert.equal(new URL(artifact).protocol, 'https:');
  return {
    platform, eas_build_id: build.id, status: 'finished', source_sha: sha,
    project_id: projectId, profile: 'preview', distribution: 'internal',
    app_version: build.appVersion,
    ...(platform === 'ios' ? { build_number: build.appBuildVersion } : { version_code: build.appBuildVersion }),
    artifact_url: artifact,
    install_url: `https://expo.dev/accounts/${owner}/projects/${slug}/builds/${build.id}`,
  };
}

async function doppler(path, token) {
  const response = await fetch(`https://api.doppler.com${path}`, {
    headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(30000),
  });
  assert.ok(response.ok, `Doppler request failed: HTTP ${response.status}`);
  return response.json();
}

function command(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['--yes', 'eas-cli@24.0.0', ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    // Expo output is masked by GitHub; never print JSON responses or environment dumps.
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('error', () => reject(new Error('Unable to start EAS CLI')));
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`EAS ${args[0]} failed with exit ${code}; inspect signing/build diagnostics above.`));
      try { resolve(JSON.parse(output)); } catch { reject(new Error('EAS returned malformed JSON')); }
    });
  });
}

async function main() {
  const [sha, platform, proofPath, receiptPath] = process.argv.slice(2);
  validateSha(sha);
  assert.ok(['all', 'ios', 'android'].includes(platform));
  assert.equal(process.env.GITHUB_REPOSITORY?.toLowerCase(), repository);
  assert.equal(process.env.GITHUB_WORKFLOW, 'KIVO Mobile Stage H');
  assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  assert.equal(git('rev-parse', 'HEAD'), sha);
  assert.equal(git('status', '--porcelain'), '', 'Build source must be clean');
  const config = JSON.parse(execFileSync('./node_modules/.bin/expo', ['config', '--type', 'public', '--json'], { encoding: 'utf8' }));
  verifyConfig(config, JSON.parse(readFileSync('eas.json', 'utf8')));
  const proof = JSON.parse(readFileSync(proofPath, 'utf8'));
  assert.equal(proof.source_sha, sha);
  assert.match(proof.run_id, /^\d+$/);

  const token = process.env.DOPPLER_TOKEN;
  assert.ok(token, 'DOPPLER_TOKEN is missing');
  // Reject personal/CLI/OIDC credentials; only a config-scoped service token is permitted.
  assert.ok(token.startsWith('dp.st.'), 'Require a Doppler config Service Token');
  const identity = await doppler('/v3/me', token);
  // Non-secret ID of the service token independently audited as read-only kivo/stg.
  assert.equal(identity.slug, '2fb770f0-d12b-46ff-ade1-7993b0441925', 'Unapproved Doppler service token identity');
  assert.equal(identity.name, 'kivo-stage-h');
  const context = await doppler('/v3/configs/config/secrets/download?format=json&secrets=DOPPLER_PROJECT,DOPPLER_CONFIG', token);
  assert.equal(context.DOPPLER_PROJECT, 'kivo', 'Doppler token project mismatch');
  assert.equal(context.DOPPLER_CONFIG, 'stg', 'Doppler token config mismatch');
  const secrets = await doppler('/v3/configs/config/secrets/download?project=kivo&config=stg&format=json&secrets=EXPO_TOKEN', token);
  assert.ok(typeof secrets.EXPO_TOKEN === 'string' && secrets.EXPO_TOKEN.trim(), 'EXPO_TOKEN is unavailable');
  // Register the dynamically fetched value with GitHub's log masker; it is never logged as text.
  const escaped = secrets.EXPO_TOKEN.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  process.stdout.write(`::add-mask::${escaped}\n`);
  console.log('Doppler authentication: PASS');
  console.log('EXPO_TOKEN availability: PASS');
  const env = { ...process.env, EXPO_TOKEN: secrets.EXPO_TOKEN, CI: '1', EXPO_NO_TELEMETRY: '1' };
  for (const name of ['DOPPLER_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN', 'EAS_NO_VCS', 'EAS_BUILD_GIT_COMMIT_HASH']) delete env[name];
  const platforms = platform === 'all' ? ['android', 'ios'] : [platform];
  const builds = [];
  for (const target of platforms) {
    console.log(`Starting ${target} preview build for ${sha}`);
    const result = await command(['build', '--platform', target, '--profile', 'preview', '--non-interactive', '--wait', '--json', '--message', `KIVO ${sha}; Stage G ${proof.run_id}; Stage H ${process.env.GITHUB_RUN_ID}`], env);
    assert.ok(Array.isArray(result) && result.length === 1, 'Expected one EAS build result');
    assert.match(result[0].id ?? '', /^[0-9a-f-]{36}$/);
    const build = await command(['build:view', result[0].id, '--json'], env);
    assert.equal(build.id, result[0].id);
    builds.push(verifyBuild(build, sha, target));
    console.log(`${target} build verified: ${build.id} FINISHED`);
  }
  assert.equal(git('status', '--porcelain'), '', 'EAS modified the source tree');
  const receipt = {
    schema_version: 1, repository, source_sha: sha, stage_g: proof,
    stage_h: { run_id: process.env.GITHUB_RUN_ID, run_attempt: process.env.GITHUB_RUN_ATTEMPT, workflow: 'KIVO Mobile Stage H' },
    doppler: { project: 'kivo', config: 'stg' },
    expo: { owner, slug, project_id: projectId }, build_profile: 'preview', builds,
  };
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  console.log('Stage H receipt: created after all requested builds passed verification');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Assertion failures never contain credentials: only allowlisted metadata is asserted.
    console.error(error.code === 'ERR_ASSERTION' ? error.message : 'Stage H failed; no success receipt created.');
    process.exitCode = 1;
  });
}
