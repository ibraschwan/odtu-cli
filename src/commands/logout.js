import chalk from 'chalk';
import { getClient } from '../client.js';
import { StudentClient } from '../student-client.js';
import { deletePassword } from '../keychain.js';
import { handleErrors } from '../ui.js';

export default function (program) {
  program
    .command('logout')
    .description('Log out and clear all saved sessions')
    .option('--keep-keychain', 'Keep stored password in macOS Keychain')
    .action(handleErrors(async (options) => {
      const client = getClient(false);
      client.loadSession();
      const studentClient = new StudentClient();
      studentClient.loadSession();

      const usernames = [...new Set([client.username, studentClient.username].filter(Boolean))];
      client.clearSession();
      studentClient.clearSession();

      const keychainFailed = [];
      if (!options.keepKeychain) {
        for (const username of usernames) {
          const res = deletePassword(username);
          if (!res.ok) {
            keychainFailed.push({ username, ...res });
          }
        }
      }

      if (keychainFailed.length > 0) {
        process.exitCode = 1;
      }

      console.log(chalk.yellow('Logged out (ODTUClass + Student Portal sessions cleared).'));
      for (const failure of keychainFailed) {
        console.error(
          chalk.red(`Warning: failed to remove Keychain entry for ${failure.username}: ${failure.error}`),
        );
        console.error(
          chalk.dim(`Retry manually: security delete-generic-password -a "${failure.username}" -s odtu-cli-metu`),
        );
      }
    }));
}
