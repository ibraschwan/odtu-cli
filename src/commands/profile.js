import chalk from 'chalk';
import { getStudentClient } from '../student-client.js';
import { handleErrors, spinner, successBox, createTable } from '../ui.js';

export default function (program) {
  program
    .command('profile')
    .description('View your student profile, enrolled courses, and financial status')
    .action(handleErrors(async () => {
      const client = getStudentClient();

      const s = spinner('Fetching student profile...').start();
      const [profile, allInfo] = await Promise.all([
        client.getProfile(),
        client.getAllStudentInfo(),
      ]);
      s.stop();

      const { transcript, semester, financial } = allInfo;
      const st = transcript.student;

      // Profile box
      const profileContent = [
        `${chalk.bold.white(`${profile.firstName} ${profile.lastName}`)}`,
        '',
        `  ${chalk.dim('Student No:')}    ${st.studentNo || '-'}`,
        `  ${chalk.dim('Faculty:')}       ${st.faculty || '-'}`,
        `  ${chalk.dim('Department:')}    ${st.department || '-'}`,
        `  ${chalk.dim('Entry Date:')}    ${st.dateOfEntry || '-'}`,
      ];

      // Add GPA if available
      const lastSem = [...transcript.semesters].reverse().find(s => s.summary.cumGpa);
      if (lastSem) {
        const cumGpa = parseFloat(lastSem.summary.cumGpa);
        const gpaColor = cumGpa >= 2.0 ? chalk.green : chalk.red;
        profileContent.push(`  ${chalk.dim('Cum. GPA:')}      ${gpaColor.bold(lastSem.summary.cumGpa)}`);
        profileContent.push(`  ${chalk.dim('Standing:')}      ${standingColor(lastSem.summary.standing)(lastSem.summary.standing)}`);
      }

      successBox(profileContent.join('\n'), 'Student Profile');

      // Enrolled courses this semester
      if (semester.registrationCourses.length) {
        console.log(chalk.bold('\n  Registered Courses\n'));
        const table = createTable(['Code', 'Course', 'Credit', 'Category', 'Section'], { noBorder: true });
        for (const c of semester.registrationCourses) {
          table.push([
            chalk.cyan(c.code),
            chalk.bold(c.name),
            chalk.dim(c.credit),
            chalk.dim(c.category),
            chalk.dim(c.section),
          ]);
        }
        console.log(table.toString());
      }

      // Financial status
      console.log(chalk.bold('\n  Financial Status\n'));
      const finTable = createTable(['', 'Amount'], { noBorder: true });
      finTable.push([chalk.dim('Tuition Debt'), financial.tuition.debt === '0.00' ? chalk.green('0.00 TL') : chalk.red(`${financial.tuition.debt} TL`)]);
      finTable.push([chalk.dim('Tuition Paid'), chalk.dim(`${financial.tuition.payment} TL`)]);
      finTable.push([chalk.dim('Library Debt'), financial.library.debt || chalk.green('None')]);
      console.log(finTable.toString());

      // Available services
      if (profile.programs) {
        console.log(chalk.bold('\n  Available Services\n'));
        for (const p of profile.programs) {
          console.log(`    ${chalk.dim(String(p.program_code).padStart(3))}  ${p.program_name}`);
        }
      }

      console.log();
    }));
}

function standingColor(standing) {
  if (!standing) return chalk.dim;
  const s = standing.toUpperCase();
  if (s === 'SATISFACTORY') return chalk.green;
  if (s === 'UNSATISFACTORY') return chalk.yellow;
  if (s === 'PROBATION') return chalk.red;
  return chalk.white;
}
