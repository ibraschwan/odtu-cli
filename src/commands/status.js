import chalk from 'chalk';
import { getClient } from '../client.js';
import { handleErrors, spinner, infoBox } from '../ui.js';

export default function (program) {
  program
    .command('status')
    .description('Check login status')
    .action(handleErrors(async () => {
      const client = getClient(false);
      if (!client.loadSession()) {
        console.log(chalk.yellow('Not logged in. Run: ') + chalk.cyan('odtu login'));
        return;
      }

      const s = spinner('Checking session...').start();
      let valid = await client.isAuthenticated();

      // Auto re-login if session expired and credentials are saved
      if (!valid && client._canAutoReLogin()) {
        s.text = 'Session expired, re-authenticating...';
        try {
          await client._autoReLogin();
          valid = await client.isAuthenticated();
        } catch { /* re-login failed */ }
      }
      s.stop();

      if (valid) {
        let fullname = client.username;
        try {
          const info = await client.getSiteInfo();
          fullname = info.fullname || client.username;
        } catch { /* ignore */ }

        infoBox(
          `${chalk.green.bold('Logged in')}\n` +
          `User:     ${fullname}\n` +
          `Semester: ${client.semesterDisplay}\n` +
          `User ID:  ${client.userId}`,
          'Session Status',
        );
      } else {
        console.log(chalk.red('Session expired. Run: ') + chalk.cyan('odtu login'));
        client.clearSession();
      }
    }));
}
