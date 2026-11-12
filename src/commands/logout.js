import chalk from 'chalk';
import { getClient } from '../client.js';
import { handleErrors, isJsonMode, emitJson } from '../ui.js';

export default function (program) {
  program
    .command('logout')
    .description('Log out and clear saved session')
    .action(handleErrors(async () => {
      const client = getClient(false);
      client.clearSession();
      if (isJsonMode()) {
        emitJson({ ok: true, loggedOut: true });
        return;
      }
      console.log(chalk.yellow('Logged out.'));
    }));
}
