import chalk from 'chalk';
import { select, input, password } from '@inquirer/prompts';
import { ODTUClassClient, makeBaseUrl } from '../client.js';
import { StudentClient } from '../student-client.js';
import {
  showBanner, spinner, successBox,
  guessSemester, semesterLabel, semesterArt, handleErrors,
  currentAcademicYear, academicYearLabel, isJsonMode, emitJson,
} from '../ui.js';

export default function (program) {
  program
    .command('login')
    .description('Log in to ODTU with interactive setup')
    .option('-u, --username <username>', 'METU username')
    .option('-p, --password <password>', 'METU password')
    .option('-y, --year <year>', 'Academic start year (e.g. 2026 for 2026-2027)', parseInt)
    .option('-s, --semester <semester>', 'Semester: f=Fall, s=Spring, u=Summer')
    .action(handleErrors(async (options) => {
      await showBanner();

      const acadYear = currentAcademicYear();

      if (!isJsonMode()) {
        console.log(chalk.cyan.bold('\n  Step 1/3 ') + chalk.dim('Select your semester\n'));
      }

      let year = options.year;
      if (!year) {
        if (isJsonMode()) {
          year = acadYear;
        } else {
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
      }

      let semester = options.semester;
      if (!semester) {
        if (isJsonMode()) {
          semester = guessSemester();
        } else {
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
      }

      const domain = new URL(makeBaseUrl(year, semester)).host;
      if (!isJsonMode()) {
        console.log(`\n  ${chalk.green.bold(`${academicYearLabel(year)} ${semesterLabel(semester)}`)} ${semesterArt(semester)}`);
        console.log(`  ${chalk.dim(domain)}\n`);
        console.log(chalk.cyan.bold('  Step 2/3 ') + chalk.dim('Enter your METU credentials\n'));
      }

      const username = options.username || await input({ message: 'METU Username' });
      const pw = options.password || await password({ message: 'Password', mask: '*' });

      if (!isJsonMode()) {
        console.log('\n' + chalk.cyan.bold('  Step 3/3 ') + chalk.dim('Connecting\n'));
      }

      const s = spinner('Connecting to ODTUClass...').start();
      const client = new ODTUClassClient(year, semester);

      await client.login(username, pw, (msg) => { s.text = msg; });
      s.succeed('ODTUClass connected!');

      const s2 = spinner('Connecting to Student Portal...').start();
      let studentOk = false;
      try {
        const studentClient = new StudentClient();
        await studentClient.login(username, pw);
        s2.succeed('Student Portal connected!');
        studentOk = true;
      } catch {
        s2.warn('Student Portal login failed (ODTUClass still works)');
      }

      let fullname = username;
      try {
        const info = await client.getSiteInfo();
        fullname = info.fullname || username;
      } catch { /* ignore */ }

      if (isJsonMode()) {
        emitJson({
          ok: true,
          username,
          fullname,
          year,
          semester,
          domain,
          studentPortal: studentOk,
        });
        return;
      }

      const portalLine = studentOk
        ? `  Portal:    ${chalk.green('student.metu.edu.tr')}\n`
        : `  Portal:    ${chalk.dim('not connected')}\n`;

      successBox(
        `${chalk.green.bold(`Welcome, ${fullname}!`)}\n\n` +
        `  Semester:  ${chalk.bold(`${academicYearLabel(year)} ${semesterLabel(semester)}`)}\n` +
        `  Domain:    ${chalk.dim(domain)}\n` +
        portalLine +
        `  Session:   ${chalk.dim('saved to ~/.odtuclass/')}\n\n` +
        `${chalk.dim('Quick start:')}\n` +
        `  ${chalk.cyan('odtu courses')}       List your courses\n` +
        `  ${chalk.cyan('odtu grades')}        View your grades\n` +
        `  ${chalk.cyan('odtu transcript')}    Full transcript\n` +
        `  ${chalk.cyan('odtu gpa')}           GPA history\n` +
        `  ${chalk.cyan('odtu curriculum')}    Curriculum progress\n` +
        `  ${chalk.cyan('odtu profile')}       Student profile\n` +
        `  ${chalk.cyan('odtu dashboard')}     Full overview`,
        chalk.green.bold('Login Successful'),
      );
    }));
}
