import chalk from 'chalk';
import { getStudentClient } from '../student-client.js';
import { handleErrors, spinner, createTable, infoBox } from '../ui.js';

export default function (program) {
  program
    .command('transcript')
    .description('View your full university transcript from student.metu.edu.tr')
    .action(handleErrors(async () => {
      const client = getStudentClient();

      const s = spinner('Fetching transcript from student portal...').start();
      const data = await client.getTranscript();
      s.stop();

      if (!data.semesters.length) {
        console.log(chalk.yellow('No transcript data found.'));
        return;
      }

      // Student info header
      const info = data.student;
      const header = [
        `${chalk.bold(info.givenName || '')} ${chalk.bold(info.familyName || '')}`,
        `${chalk.dim('Student No:')} ${info.studentNo || '-'}`,
        `${chalk.dim('Faculty:')} ${info.faculty || '-'}`,
        `${chalk.dim('Department:')} ${info.department || '-'}`,
        `${chalk.dim('Entry Date:')} ${info.dateOfEntry || '-'}`,
      ].join('\n');
      infoBox(header, 'Student Profile');

      // Each semester
      for (const sem of data.semesters) {
        console.log(chalk.bold.cyan(`\n  ${sem.name}`));

        if (sem.courses.length) {
          const table = createTable(['Code', 'Course', 'Credit', 'Grade', 'ECTS'], { noBorder: true });
          for (const c of sem.courses) {
            const gradeColor = getGradeColor(c.grade);
            table.push([
              chalk.dim(c.code),
              c.name,
              chalk.dim(c.credit),
              gradeColor(c.grade || '-'),
              chalk.dim(c.ectsCredit || '-'),
            ]);
          }
          console.log(table.toString());
        }

        // Summary
        const sm = sem.summary;
        if (sm.gpa) {
          const gpaColor = parseFloat(sm.gpa) >= 2.0 ? chalk.green : chalk.red;
          const cumColor = parseFloat(sm.cumGpa) >= 2.0 ? chalk.green : chalk.red;
          console.log(
            `    ${chalk.dim('GPA:')} ${gpaColor.bold(sm.gpa)}` +
            `  ${chalk.dim('Cum.GPA:')} ${cumColor.bold(sm.cumGpa)}` +
            `  ${chalk.dim('Credits:')} ${sm.totalCredits}` +
            `  ${chalk.dim('Standing:')} ${standingColor(sm.standing)(sm.standing)}`
          );
        }
      }

      // Notes
      if (data.notes.length) {
        console.log(chalk.dim('\n  ' + data.notes.join('\n  ')));
      }

      console.log();
    }));
}

function getGradeColor(grade) {
  if (!grade) return chalk.dim;
  const passing = { AA: chalk.green.bold, BA: chalk.green, BB: chalk.green, CB: chalk.cyan, CC: chalk.cyan, DC: chalk.yellow, DD: chalk.yellow, S: chalk.green, EX: chalk.green, P: chalk.green };
  const failing = { FD: chalk.red, FF: chalk.red.bold, NA: chalk.red.bold, W: chalk.gray, U: chalk.red };
  return passing[grade] || failing[grade] || chalk.white;
}

function standingColor(standing) {
  if (!standing) return chalk.dim;
  const s = standing.toUpperCase();
  if (s === 'SATISFACTORY') return chalk.green;
  if (s === 'UNSATISFACTORY') return chalk.yellow;
  if (s === 'PROBATION') return chalk.red;
  return chalk.white;
}
