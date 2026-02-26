import chalk from 'chalk';
import { getStudentClient } from '../student-client.js';
import { handleErrors, spinner, createTable } from '../ui.js';

export default function (program) {
  program
    .command('curriculum')
    .description('View your curriculum with completion status')
    .action(handleErrors(async () => {
      const client = getStudentClient();

      const s = spinner('Fetching curriculum...').start();
      const data = await client.getCurriculum();
      s.stop();

      if (!data.length) {
        console.log(chalk.yellow('No curriculum data found.'));
        return;
      }

      console.log(chalk.bold('\n  Curriculum Progress\n'));

      let totalCourses = 0;
      let completedCourses = 0;

      for (const sem of data) {
        console.log(chalk.bold.cyan(`  ${sem.name}`));

        const table = createTable(['', 'Course', 'Category', 'Grade'], { noBorder: true });
        for (const c of sem.courses) {
          totalCourses++;
          const icon = c.completed ? chalk.green('✓') : (c.grade ? chalk.red('✗') : chalk.dim('○'));
          if (c.completed) completedCourses++;

          const gradeColor = c.completed ? chalk.green : (c.grade ? chalk.red : chalk.dim);

          table.push([
            icon,
            chalk.bold(c.code),
            chalk.dim(c.category || '-'),
            gradeColor(c.grade || '-'),
          ]);
        }
        console.log(table.toString());
      }

      // Progress summary
      const pct = totalCourses > 0 ? ((completedCourses / totalCourses) * 100).toFixed(0) : 0;
      const barLen = 30;
      const filled = Math.round((completedCourses / totalCourses) * barLen);
      const bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(barLen - filled));

      console.log(`\n  Progress: ${chalk.bold(completedCourses)}/${totalCourses} courses (${chalk.bold(pct)}%)`);
      console.log(`  [${bar}]`);
      console.log(`  ${chalk.green('✓')} Completed  ${chalk.red('✗')} Failed  ${chalk.dim('○')} Not taken\n`);
    }));
}
