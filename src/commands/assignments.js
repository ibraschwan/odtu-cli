import chalk from 'chalk';
import { getClient } from '../client.js';
import { handleErrors, spinner, createTable, tsToStr } from '../ui.js';

export default function (program) {
  program
    .command('assignments [courseId]')
    .description('List assignments. Optionally filter by COURSE_ID')
    .action(handleErrors(async (courseId) => {
      const client = getClient();

      const s = spinner('Fetching courses...').start();
      const allCourses = await client.getCourses();
      s.text = 'Fetching assignments...';

      const courseIds = courseId ? [parseInt(courseId)] : allCourses.map(c => c.id);
      const courseNames = {};
      for (const c of allCourses) courseNames[c.id] = c.fullname;

      const data = await client.getAssignments(courseIds);
      s.stop();

      if (!data.length) {
        console.log(chalk.yellow('No assignments found.'));
        return;
      }

      console.log(chalk.bold('\n  Assignments\n'));

      const table = createTable(['Course', 'Assignment', 'Type', 'Due']);
      for (const a of data) {
        const cname = courseNames[a.courseid] || `Course ${a.courseid}`;
        table.push([
          chalk.cyan(cname),
          chalk.bold(a.name || '?'),
          chalk.dim(a.modname || '?'),
          chalk.yellow(tsToStr(a.duedate)),
        ]);
      }
      console.log(table.toString());
      console.log(chalk.dim(`\n  ${data.length} assignments total`));
    }));
}
