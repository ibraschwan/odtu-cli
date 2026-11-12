/**
 * macOS Keychain helper (with ODTU_PASSWORD env fallback for Linux/headless).
 * Uses `security -i` with hex-encoded passwords (-X) and a pure-ASCII `odtu-b64:` prefix
 * so non-ASCII passwords round-trip cleanly without triggering `security -w` hex output.
 */

import { spawnSync } from 'child_process';

const SERVICE = 'odtu-cli-metu';
const B64_PREFIX = 'odtu-b64:';

export function isMacKeychainSupported() {
  return process.platform === 'darwin';
}

export function getKeychainPassword(username) {
  if (!isMacKeychainSupported() || !username) return null;

  const res = spawnSync(
    'security',
    ['find-generic-password', '-w', '-a', username, '-s', SERVICE],
    { encoding: 'utf8' },
  );
  if (res.status !== 0 || typeof res.stdout !== 'string') return null;
  const raw = res.stdout.replace(/\r?\n$/, '');
  if (!raw.length) return null;
  if (raw.startsWith(B64_PREFIX)) {
    return Buffer.from(raw.slice(B64_PREFIX.length), 'base64').toString('utf8');
  }
  return raw;
}

export function getPassword(username) {
  if (process.env.ODTU_PASSWORD) {
    return process.env.ODTU_PASSWORD;
  }
  return getKeychainPassword(username);
}

export function hasKeychainPassword(username) {
  if (!isMacKeychainSupported() || !username) return false;

  const res = spawnSync(
    'security',
    ['find-generic-password', '-a', username, '-s', SERVICE],
    { stdio: 'ignore' },
  );
  return res.status === 0;
}

export function hasPassword(username) {
  if (process.env.ODTU_PASSWORD) return true;
  return hasKeychainPassword(username);
}

export function savePassword(username, password) {
  if (!isMacKeychainSupported() || !username || !password) return false;

  // Store ASCII-only base64 payload so `security find-generic-password -w` never hex-encodes UTF-8 bytes
  const encoded = `${B64_PREFIX}${Buffer.from(password, 'utf8').toString('base64')}`;
  const hex = Buffer.from(encoded, 'utf8').toString('hex');
  const acct = JSON.stringify(username);
  const cmd = `add-generic-password -U -a ${acct} -s "${SERVICE}" -X ${hex}\n`;

  const res = spawnSync('security', ['-i'], {
    input: cmd,
    encoding: 'utf8',
  });
  return res.status === 0;
}

export function deletePassword(username) {
  if (!isMacKeychainSupported() || !username) {
    return { ok: true, removed: false, notFound: true };
  }
  const res = spawnSync(
    'security',
    ['delete-generic-password', '-a', username, '-s', SERVICE],
    { encoding: 'utf8' },
  );
  if (res.status === 0) {
    return { ok: true, removed: true, notFound: false };
  }
  const err = (res.stderr || res.stdout || '').trim();
  // macOS `security` exits 44 ("The specified item could not be found in the keychain")
  if (res.status === 44 || /could not be found/i.test(err)) {
    return { ok: true, removed: false, notFound: true };
  }
  return {
    ok: false,
    removed: false,
    notFound: false,
    error: err || `security exited with status ${res.status}`,
  };
}
