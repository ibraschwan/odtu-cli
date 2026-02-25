import chalk from 'chalk';
import { select, input, password } from '@inquirer/prompts';
import { ODTUClassClient, getClient } from '../client.js';
import {
  showBanner, spinner, handleErrors,
  guessSemester, semesterLabel, semesterArt,
  currentAcademicYear, academicYearLabel,
} from '../ui.js';

export default function (program) {
  program
    .command('switch')
    .description('Switch to a different semester (re-login required)')
    .action(handleErrors(async () => {
      const oldClient = getClient(false);
      const hadSession = oldClient.loadSession();
      const oldUsername = hadSession ? oldClient.username : null;

      await showBanner();

      const acadYear = currentAcademicYear();
      console.log(chalk.bold('\n  Select new semester:\n'));

      const years = [];
      for (let y = acadYear; y >= acadYear - 3; y--) years.push(y);

      const year = await select({
        message: 'Academic year',
        choices: years.map(y => ({
          name: `${academicYearLabel(y)}${y === acadYear ? chalk.dim(' (current)') : ''}`,
          value: y,
        })),
        default: acadYear,
      });

      const semester = await select({
        message: 'Semester',
        choices: [
          { name: `  ${chalk.yellow('Fall')}     Sep - Jan`, value: 'f' },
          { name: `  ${chalk.green('Spring')}   Feb - Jun`, value: 's' },
          { name: `  ${chalk.red('Summer')}   Jul - Aug`, value: 'u' },
        ],
        default: guessSemester(),
      });

      const domain = `odtuclass${year}${semester}.metu.edu.tr`;
      console.log(`\n  Switching to ${chalk.bold(`${academicYearLabel(year)} ${semesterLabel(semester)}`)} (${domain})\n`);

      const username = await input({
        message: 'Username',
        default: oldUsername || undefined,
      });
      const pw = await password({ message: 'Password', mask: '*' });

      const s = spinner(`Logging in to ${domain}...`).start();
      const newClient = new ODTUClassClient(year, semester);
      await newClient.login(username, pw, (msg) => { s.text = msg; });
      s.succeed(`Switched to ${academicYearLabel(year)} ${semesterLabel(semester)}!`);
    }));
}
