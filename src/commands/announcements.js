import chalk from 'chalk';
import boxen from 'boxen';
import { getClient } from '../client.js';
import { handleErrors, spinner, tsToStr, isJsonMode, emitJson } from '../ui.js';

export default function (program) {
  program
    .command('announcements [courseId]')
    .description('Show announcements. All courses if no COURSE_ID, or one specific course')
    .option('-n, --limit <count>', 'Max announcements per course', '5')
    .option('-f, --filter <filter>', 'Course filter when courseId omitted: all|inprogress', 'all')
    .action(handleErrors(async (courseId, options) => {
      const client = getClient();
      const limit = parseInt(options.limit, 10);

      const s = spinner('Fetching announcements...').start();

      let courses;
      if (courseId) {
        const all = await client.getCourses();
        const match = all.find(c => c.id === parseInt(courseId, 10));
        courses = match ? [match] : [{ id: parseInt(courseId, 10), fullname: `Course ${courseId}` }];
      } else {
        courses = await client.getCourses(options.filter || 'all');
      }

      if (!courses.length) {
        s.stop();
        if (isJsonMode()) {
          emitJson({ announcements: [] });
          return;
        }
        console.log(chalk.yellow('No courses found.'));
        return;
      }

      const courseIds = courses.map(c => c.id);
      const courseNames = {};
      for (const c of courses) courseNames[c.id] = c.fullname;

      s.text = 'Loading announcements...';
      const announcements = await client.getAnnouncements(courseIds, limit, courseNames);
      s.stop();

      if (isJsonMode()) {
        emitJson({ announcements });
        return;
      }

      if (!announcements.length) {
        console.log(chalk.yellow('No announcements found.'));
        return;
      }

      const title = courseId
        ? `Announcements - ${courseNames[parseInt(courseId, 10)] || `Course ${courseId}`}`
        : 'Announcements (all courses)';

      console.log(chalk.bold(`\n  ${title}\n`));

      for (const a of announcements) {
        const date = a.created ? tsToStr(a.created) : (a.dateText || '-');
        const preview = a.message.slice(0, 300) + (a.message.length > 300 ? '...' : '');
        const courseTag = courseId ? '' : `\n${chalk.cyan(a.course)}`;

        console.log(boxen(
          `${courseTag ? chalk.cyan(a.course) + '\n' : ''}` +
          `${chalk.dim(`${a.author}  ·  ${date}`)}\n\n` +
          `${preview || chalk.dim('(no content)')}`,
          {
            title: `  ${chalk.bold(a.name)}  `,
            titleAlignment: 'left',
            borderColor: 'yellow',
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            margin: { top: 0, bottom: 0, left: 2, right: 2 },
          },
        ));
      }

      console.log(chalk.dim(`\n  ${announcements.length} announcements total\n`));
    }));
}
