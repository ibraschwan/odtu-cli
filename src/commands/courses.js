import chalk from 'chalk';
import { getClient } from '../client.js';
import { handleErrors, spinner, createTable } from '../ui.js';

export default function (program) {
  program
    .command('courses')
    .description('List enrolled courses')
    .option('-f, --filter <filter>', 'Filter: all|inprogress|future|past', 'all')
    .action(handleErrors(async (options) => {
      const client = getClient();

      const s = spinner('Fetching courses...').start();
      const courseList = await client.getCourses(options.filter);
      s.stop();

      if (!courseList.length) {
        console.log(chalk.yellow('No courses found.'));
        return;
      }

      console.log(chalk.bold(`\n  Enrolled Courses  ${chalk.dim(`(${client.semesterDisplay})`)}\n`));

      const table = createTable(['ID', 'Course', 'Category', 'Fav']);
      for (const c of courseList) {
        const fav = c.isfavourite ? chalk.yellow('*') : '';
        table.push([
          chalk.dim(String(c.id)),
          chalk.bold(c.fullname),
          chalk.cyan(c.coursecategory || '-'),
          fav,
        ]);
      }
      console.log(table.toString());
      console.log(chalk.dim(`\n  ${courseList.length} courses total`));
    }));
}
