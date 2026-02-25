import chalk from 'chalk';
import { getClient } from '../client.js';
import { handleErrors, spinner, createTable } from '../ui.js';

export default function (program) {
  program
    .command('grades [courseId]')
    .description('Show grades. Provide COURSE_ID for detailed grades, or omit for overview')
    .action(handleErrors(async (courseId) => {
      const client = getClient();
      const cid = courseId ? parseInt(courseId) : null;

      if (cid) {
        await showCourseGrades(client, cid);
      } else {
        await showGradesOverview(client);
      }
    }));
}

async function showGradesOverview(client) {
  const s = spinner('Fetching grades overview...').start();
  const gradeList = await client.getGradesOverview();
  s.stop();

  if (!gradeList.length) {
    console.log(chalk.yellow('No grades available.'));
    return;
  }

  console.log(chalk.bold(`\n  Grades Overview  ${chalk.dim(`(${client.semesterDisplay})`)}\n`));

  const table = createTable(['ID', 'Course', 'Grade']);
  for (const g of gradeList) {
    table.push([
      chalk.dim(String(g.courseid || '-')),
      chalk.bold(g.coursename || '?'),
      chalk.green(String(g.grade || '-')),
    ]);
  }
  console.log(table.toString());
  console.log(chalk.dim('\n  Use ') + chalk.bold('odtu grades <COURSE_ID>') + chalk.dim(' for detailed grades'));
}

async function showCourseGrades(client, courseId) {
  const s = spinner('Fetching course grades...').start();
  const items = await client.getCourseGrades(courseId);
  s.stop();

  if (!items.length) {
    console.log(chalk.yellow('No grade items found.'));
    return;
  }

  const hasRange = items.some(i => i.range);
  const hasPct = items.some(i => i.percentage);
  const hasWeight = items.some(i => i.weight);
  const hasFeedback = items.some(i => i.feedback);

  const head = ['Item', 'Grade'];
  if (hasRange) head.push('Range');
  if (hasPct) head.push('Percentage');
  if (hasWeight) head.push('Weight');
  if (hasFeedback) head.push('Feedback');

  console.log(chalk.bold(`\n  Grades for Course ${courseId}\n`));

  const table = createTable(head);
  for (const item of items) {
    const row = [
      chalk.bold(item.itemname || '?'),
      chalk.green(item.grade || '-'),
    ];
    if (hasRange) row.push(chalk.dim(item.range || '-'));
    if (hasPct) row.push(chalk.cyan(item.percentage || '-'));
    if (hasWeight) row.push(chalk.dim(item.weight || '-'));
    if (hasFeedback) row.push((item.feedback || '-').slice(0, 80));
    table.push(row);
  }
  console.log(table.toString());
}
