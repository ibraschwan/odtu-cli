/**
 * macOS Keychain helper (with ODTU_PASSWORD env fallback for Linux/headless).
 * Uses `security -i` with hex-encoded passwords (-X) so secrets never appear in argv/ps.
 */

import { spawnSync } from 'child_process';

const SERVICE = 'odtu-cli-metu';

export function isMacKeychainSupported() {
  return process.platform === 'darwin';
}

export function getPassword(username) {
  if (process.env.ODTU_PASSWORD) {
    return process.env.ODTU_PASSWORD;
  }
  if (!isMacKeychainSupported() || !username) return null;

  const res = spawnSync(
    'security',
    ['find-generic-password', '-w', '-a', username, '-s', SERVICE],
    { encoding: 'utf8' },
  );
  if (res.status !== 0 || typeof res.stdout !== 'string') return null;
  const password = res.stdout.replace(/\r?\n$/, '');
  return password.length ? password : null;
}

export function hasPassword(username) {
  if (process.env.ODTU_PASSWORD) return true;
  if (!isMacKeychainSupported() || !username) return false;

  const res = spawnSync(
    'security',
    ['find-generic-password', '-a', username, '-s', SERVICE],
    { stdio: 'ignore' },
  );
  return res.status === 0;
}

export function savePassword(username, password) {
  if (!isMacKeychainSupported() || !username || !password) return false;

  const hex = Buffer.from(password, 'utf8').toString('hex');
  const acct = JSON.stringify(username);
  const cmd = `add-generic-password -U -a ${acct} -s "${SERVICE}" -X ${hex}\n`;

  const res = spawnSync('security', ['-i'], {
    input: cmd,
    encoding: 'utf8',
  });
  return res.status === 0;
}

export function deletePassword(username) {
  if (!isMacKeychainSupported() || !username) return false;
  const res = spawnSync(
    'security',
    ['delete-generic-password', '-a', username, '-s', SERVICE],
    { stdio: 'ignore' },
  );
  return res.status === 0;
}
