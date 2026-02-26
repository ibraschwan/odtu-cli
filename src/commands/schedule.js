import chalk from 'chalk';
import { getStudentClient } from '../student-client.js';
import { handleErrors, spinner } from '../ui.js';
import Table from 'cli-table3';

export default function (program) {
  program
    .command('schedule')
    .description('View your weekly course schedule')
    .action(handleErrors(async () => {
      const client = getStudentClient();

      const s = spinner('Fetching course schedule...').start();
      const data = await client.getCourseSchedule();
      s.stop();

      if (!data.length) {
        console.log(chalk.yellow('No schedule data found. Schedule may not be available yet for this semester.'));
        return;
      }

      console.log(chalk.bold('\n  Weekly Course Schedule\n'));

      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const table = new Table({
        head: [chalk.dim('Time'), ...days.map(d => chalk.cyan(d))],
        style: { head: [] },
        colWidths: [8, 18, 18, 18, 18, 18],
      });

      for (const slot of data) {
        const row = [chalk.bold(slot.time)];
        for (const day of days) {
          const course = slot[day] || '';
          row.push(course ? chalk.green(course) : chalk.dim('-'));
        }
        table.push(row);
      }

      console.log(table.toString());
      console.log();
    }));
}
