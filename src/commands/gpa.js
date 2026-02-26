import chalk from 'chalk';
import { getStudentClient } from '../student-client.js';
import { handleErrors, spinner, createTable } from '../ui.js';

export default function (program) {
  program
    .command('gpa')
    .description('View semester-by-semester GPA breakdown')
    .action(handleErrors(async () => {
      const client = getStudentClient();

      const s = spinner('Fetching transcript...').start();
      const data = await client.getTranscript();
      s.stop();

      if (!data.semesters.length) {
        console.log(chalk.yellow('No GPA data found.'));
        return;
      }

      console.log(chalk.bold('\n  GPA History\n'));

      const table = createTable(['Semester', 'GPA', 'Cum.GPA', 'Credits', 'Grade Pts', 'Standing']);
      for (const sem of data.semesters) {
        const sm = sem.summary;
        if (!sm.gpa) continue;

        const gpa = parseFloat(sm.gpa);
        const cumGpa = parseFloat(sm.cumGpa);
        const gpaColor = gpa >= 2.0 ? chalk.green : (gpa >= 1.0 ? chalk.yellow : chalk.red);
        const cumColor = cumGpa >= 2.0 ? chalk.green : (cumGpa >= 1.0 ? chalk.yellow : chalk.red);

        table.push([
          chalk.bold(sem.name),
          gpaColor.bold(sm.gpa),
          cumColor.bold(sm.cumGpa),
          chalk.dim(sm.totalCredits),
          chalk.dim(sm.totalGradePoints),
          standingColor(sm.standing)(sm.standing),
        ]);
      }
      console.log(table.toString());

      // Final summary
      const last = [...data.semesters].reverse().find(s => s.summary.cumGpa);
      if (last) {
        const cumGpa = parseFloat(last.summary.cumGpa);
        const color = cumGpa >= 2.0 ? chalk.green : chalk.red;

        // GPA bar visualization
        const barLen = 30;
        const filled = Math.round((cumGpa / 4.0) * barLen);
        const bar = color('█'.repeat(filled)) + chalk.dim('░'.repeat(barLen - filled));

        console.log(`\n  Current Cumulative GPA: ${color.bold(last.summary.cumGpa)} / 4.00`);
        console.log(`  [${bar}]`);

        // Total credits earned
        let totalCredits = 0;
        for (const sem of data.semesters) {
          for (const c of sem.courses) {
            const grade = c.grade;
            const credit = parseFloat(c.credit) || 0;
            if (['AA','BA','BB','CB','CC','DC','DD','S','EX','P'].includes(grade)) {
              totalCredits += credit;
            }
          }
        }
        console.log(`  Total Credits Earned: ${chalk.bold(totalCredits.toFixed(0))}`);
        console.log(`  Standing: ${standingColor(last.summary.standing).bold(last.summary.standing)}`);
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
