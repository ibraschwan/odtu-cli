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

      const username = client.username || studentClient.username;
      client.clearSession();
      studentClient.clearSession();

      if (!options.keepKeychain && username) {
        deletePassword(username);
      }

      console.log(chalk.yellow('Logged out (ODTUClass + Student Portal sessions cleared).'));
    }));
}
