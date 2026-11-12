import chalk from 'chalk';
import { getClient } from '../client.js';
import { handleErrors, spinner, createTable, isJsonMode, emitJson } from '../ui.js';

export default function (program) {
  program
    .command('attendance [courseId]')
    .description('Show attendance records across courses or for one COURSE_ID')
    .action(handleErrors(async (courseId) => {
      const client = getClient();
      const s = spinner('Fetching attendance...').start();

      const courses = courseId
        ? [{ id: parseInt(courseId, 10), fullname: `Course ${courseId}` }]
        : await client.getCourses();

      const results = [];
      for (const c of courses) {
        const sections = await client.getCourseContents(c.id);
        for (const sec of sections) {
          for (const mod of (sec.modules || [])) {
            if (mod.modname === 'attendance' && mod.id) {
              const data = await client.getAttendance(mod.id);
              results.push({
                courseId: c.id,
                courseName: c.fullname || data.courseTitle,
                ...data,
              });
            }
          }
        }
      }
      s.stop();

      if (isJsonMode()) {
        emitJson({ attendance: results });
        return;
      }

      if (!results.length) {
        console.log(chalk.yellow('No attendance modules found.'));
        return;
      }

      for (const att of results) {
        console.log(chalk.bold.cyan(`\n  ${att.courseName} (cmid: ${att.cmid})\n`));
        if (!att.sessions.length) {
          console.log(chalk.dim('  No attendance sessions recorded.'));
          continue;
        }
        const table = createTable(['Date', 'Description', 'Status', 'Points', 'Remarks']);
        for (const sess of att.sessions) {
          table.push([sess.date, sess.description, sess.status, sess.points, sess.remarks]);
        }
        console.log(table.toString());
      }
      console.log();
    }));
}
