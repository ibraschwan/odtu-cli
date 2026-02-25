import chalk from 'chalk';
import boxen from 'boxen';
import { getClient } from '../client.js';
import {
  showBanner, spinner, createTable, tsToStr, handleErrors,
} from '../ui.js';

export default function (program) {
  program
    .command('dashboard')
    .description('Show a summary dashboard')
    .action(handleErrors(async () => {
      const client = getClient();

      const s = spinner('Loading dashboard...').start();
      const coursesData = await client.getCourses('inprogress');
      const now = Math.floor(Date.now() / 1000);
      const eventsData = await client.getCalendarEvents(now, now + 7 * 86400, 10);
      s.stop();

      await showBanner({ animate: false });

      // Status bar
      const nowStr = tsToStr(now);
      console.log(boxen(
        `${chalk.bold(client.semesterDisplay)}  |  ` +
        `User: ${chalk.bold(client.username || '?')}  |  ` +
        nowStr,
        {
          borderStyle: 'bold',
          borderColor: 'blue',
          padding: { top: 0, bottom: 0, left: 1, right: 1 },
          margin: { top: 0, bottom: 1, left: 2, right: 2 },
        },
      ));

      // Active courses
      if (coursesData.length) {
        console.log(chalk.bold('  Active Courses\n'));
        const table = createTable(['ID', 'Course'], { noBorder: true });
        for (const c of coursesData) {
          table.push([chalk.dim(String(c.id)), chalk.bold(c.fullname)]);
        }
        console.log(table.toString());
      } else {
        console.log(chalk.dim('  No active courses.'));
      }

      console.log();

      // Upcoming events
      const events = eventsData.events || [];
      if (events.length) {
        console.log(chalk.bold('  Upcoming (7 days)\n'));
        const table = createTable(['Date', 'Event'], { noBorder: true });
        const sorted = events.sort((a, b) => (a.timesort || 0) - (b.timesort || 0));
        for (const ev of sorted) {
          table.push([
            chalk.yellow(tsToStr(ev.timesort)),
            chalk.bold(ev.name || '?'),
          ]);
        }
        console.log(table.toString());
      } else {
        console.log(chalk.dim('  No upcoming events this week.'));
      }
      console.log();
    }));
}
