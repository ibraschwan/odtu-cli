import chalk from 'chalk';
import { getClient } from '../client.js';
import { handleErrors, spinner, infoBox, isJsonMode, emitJson } from '../ui.js';

export default function (program) {
  program
    .command('status')
    .description('Check login status')
    .action(handleErrors(async () => {
      const client = getClient(false);
      if (!client.loadSession()) {
        if (isJsonMode()) {
          emitJson({ loggedIn: false, reason: 'no_session' });
          return;
        }
        console.log(chalk.yellow('Not logged in. Run: ') + chalk.cyan('odtu login'));
        return;
      }

      const s = spinner('Checking session...').start();
      let valid = await client.isAuthenticated();
      let reauthenticated = false;

      // Auto re-login if session expired and credentials are saved (Keychain/env)
      if (!valid && client._canAutoReLogin()) {
        s.text = 'Session expired, re-authenticating...';
        try {
          await client._autoReLogin();
          valid = await client.isAuthenticated();
          reauthenticated = valid;
        } catch { /* re-login failed */ }
      }
      s.stop();

      if (valid) {
        let fullname = client.username;
        try {
          const info = await client.getSiteInfo();
          fullname = info.fullname || client.username;
        } catch { /* core_webservice_get_site_info may be disabled */ }

        if (isJsonMode()) {
          emitJson({
            loggedIn: true,
            username: client.username,
            fullname,
            userId: client.userId,
            year: client.year,
            semester: client.semester,
            semesterDisplay: client.semesterDisplay,
            baseUrl: client.baseUrl,
            reauthenticated,
          });
          return;
        }

        infoBox(
          `${chalk.green.bold('Logged in')}\n` +
          `User:     ${fullname}\n` +
          `Semester: ${client.semesterDisplay}\n` +
          `User ID:  ${client.userId}`,
          'Session Status',
        );
      } else {
        if (isJsonMode()) {
          emitJson({ loggedIn: false, username: client.username, reason: 'session_expired' });
          process.exitCode = 1;
          return;
        }
        console.log(chalk.red('Session expired. Run: ') + chalk.cyan('odtu login'));
      }
    }));
}
