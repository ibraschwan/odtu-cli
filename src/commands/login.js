import chalk from 'chalk';
import { select, input, password } from '@inquirer/prompts';
import { ODTUClassClient } from '../client.js';
import {
  showBanner, spinner, successBox,
  guessSemester, semesterLabel, semesterArt, handleErrors,
  currentAcademicYear, academicYearLabel,
} from '../ui.js';

export default function (program) {
  program
    .command('login')
    .description('Log in to ODTU with interactive setup')
    .option('-u, --username <username>', 'METU username')
    .option('-p, --password <password>', 'METU password')
    .option('-y, --year <year>', 'Academic start year (e.g. 2025 for 2025-2026)', parseInt)
    .option('-s, --semester <semester>', 'Semester: f=Fall, s=Spring, u=Summer')
    .action(handleErrors(async (options) => {
      // ── Animated ASCII Banner ──────────────────────────────
      await showBanner();

      const acadYear = currentAcademicYear();

      // ── Step 1: Year Selection ────────────────────────────
      console.log(chalk.cyan.bold('\n  Step 1/3 ') + chalk.dim('Select your semester\n'));

      let year = options.year;
      if (!year) {
        const years = [];
        for (let y = acadYear; y >= acadYear - 3; y--) years.push(y);

        year = await select({
          message: 'Select academic year',
          choices: years.map(y => ({
            name: `${academicYearLabel(y)}${y === acadYear ? chalk.dim(' (current)') : ''}`,
            value: y,
          })),
          default: acadYear,
        });
      }

      // ── Step 2: Semester Selection ────────────────────────
      let semester = options.semester;
      if (!semester) {
        semester = await select({
          message: 'Select semester',
          choices: [
            { name: `  ${chalk.yellow('Fall')}     Sep - Jan`, value: 'f' },
            { name: `  ${chalk.green('Spring')}   Feb - Jun`, value: 's' },
            { name: `  ${chalk.red('Summer')}   Jul - Aug`, value: 'u' },
          ],
          default: guessSemester(),
        });
      }

      const domain = `odtuclass${year}${semester}.metu.edu.tr`;
      console.log(`\n  ${chalk.green.bold(`${academicYearLabel(year)} ${semesterLabel(semester)}`)} ${semesterArt(semester)}`);
      console.log(`  ${chalk.dim(domain)}\n`);

      // ── Step 3: Credentials ───────────────────────────────
      console.log(chalk.cyan.bold('  Step 2/3 ') + chalk.dim('Enter your METU credentials\n'));

      const username = options.username || await input({ message: 'METU Username' });
      const pw = options.password || await password({ message: 'Password', mask: '*' });

      // ── Step 4: Connect ───────────────────────────────────
      console.log('\n' + chalk.cyan.bold('  Step 3/3 ') + chalk.dim('Connecting\n'));

      const s = spinner('Connecting to ODTUClass...').start();
      const client = new ODTUClassClient(year, semester);

      await client.login(username, pw, (msg) => { s.text = msg; });
      s.succeed('Connected!');

      // ── Success Screen ────────────────────────────────────
      let fullname = username;
      try {
        const info = await client.getSiteInfo();
        fullname = info.fullname || username;
      } catch { /* ignore */ }

      successBox(
        `${chalk.green.bold(`Welcome, ${fullname}!`)}\n\n` +
        `  Semester:  ${chalk.bold(`${academicYearLabel(year)} ${semesterLabel(semester)}`)}\n` +
        `  Domain:    ${chalk.dim(domain)}\n` +
        `  Session:   ${chalk.dim('saved to ~/.odtuclass/')}\n\n` +
        `${chalk.dim('Quick start:')}\n` +
        `  ${chalk.cyan('odtu courses')}      List your courses\n` +
        `  ${chalk.cyan('odtu grades')}       View your grades\n` +
        `  ${chalk.cyan('odtu assignments')}  See assignments\n` +
        `  ${chalk.cyan('odtu dashboard')}    Full overview`,
        chalk.green.bold('Login Successful'),
      );
    }));
}
