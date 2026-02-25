import chalk from 'chalk';
import boxen from 'boxen';
import { getClient } from '../client.js';
import { handleErrors, spinner, tsToStr } from '../ui.js';

export default function (program) {
  program
    .command('announcements [courseId]')
    .description('Show announcements. All courses if no COURSE_ID, or one specific course')
    .option('-n, --limit <count>', 'Max announcements per course', '5')
    .action(handleErrors(async (courseId, options) => {
      const client = getClient();
      const limit = parseInt(options.limit);

      const s = spinner('Fetching announcements...').start();

      // Get courses
      let courses;
      if (courseId) {
        const all = await client.getCourses();
        const match = all.find(c => c.id === parseInt(courseId));
        courses = match ? [match] : [{ id: parseInt(courseId), fullname: `Course ${courseId}` }];
      } else {
        courses = await client.getCourses('inprogress');
      }

      if (!courses.length) {
        s.stop();
        console.log(chalk.yellow('No courses found.'));
        return;
      }

      const courseIds = courses.map(c => c.id);
      const courseNames = {};
      for (const c of courses) courseNames[c.id] = c.fullname;

      // Find announcement forums (type === "news")
      s.text = 'Finding announcement forums...';
      const allForums = await client.getForums(courseIds);
      const newsForums = allForums.filter(f => f.type === 'news');

      if (!newsForums.length) {
        s.stop();
        console.log(chalk.yellow('No announcement forums found.'));
        return;
      }

      // Fetch discussions from each news forum
      s.text = 'Loading announcements...';
      const announcements = [];

      for (const forum of newsForums) {
        try {
          const data = await client.getForumDiscussions(forum.id);
          const discussions = (data.discussions || []).slice(0, limit);
          for (const d of discussions) {
            announcements.push({
              course: courseNames[forum.course] || `Course ${forum.course}`,
              courseId: forum.course,
              name: d.name || '?',
              author: d.userfullname || '?',
              created: d.created || 0,
              modified: d.timemodified || 0,
              message: (d.message || '').replace(/<[^>]+>/g, '').trim(),
            });
          }
        } catch { /* skip forums that error */ }
      }

      s.stop();

      if (!announcements.length) {
        console.log(chalk.yellow('No announcements found.'));
        return;
      }

      // Sort by most recent first
      announcements.sort((a, b) => b.created - a.created);

      const title = courseId
        ? `Announcements - ${courseNames[parseInt(courseId)] || `Course ${courseId}`}`
        : 'Announcements (all courses)';

      console.log(chalk.bold(`\n  ${title}\n`));

      for (const a of announcements) {
        const date = tsToStr(a.created);
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
