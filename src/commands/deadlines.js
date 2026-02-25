import chalk from 'chalk';
import { getClient } from '../client.js';
import { handleErrors, spinner, createTable, tsToStr } from '../ui.js';

export default function (program) {
  program
    .command('deadlines [courseId]')
    .description('Show upcoming deadlines and events')
    .option('-d, --days <days>', 'Number of days ahead to look', '14')
    .action(handleErrors(async (courseId, options) => {
      const client = getClient();
      const days = parseInt(options.days);
      const now = Math.floor(Date.now() / 1000);
      const end = now + (days * 86400);

      const s = spinner('Fetching events...').start();
      let data;
      if (courseId) {
        data = await client.getCalendarEventsByCourse(parseInt(courseId), 50);
      } else {
        data = await client.getCalendarEvents(now, end, 50);
      }
      s.stop();

      const events = data.events || [];
      if (!events.length) {
        console.log(chalk.yellow(`No events in the next ${days} days.`));
        return;
      }

      console.log(chalk.bold(`\n  Upcoming Events (next ${days} days)\n`));

      const table = createTable(['Date', 'Event', 'Course', 'Type']);
      const sorted = events.sort((a, b) => (a.timesort || 0) - (b.timesort || 0));
      for (const ev of sorted) {
        table.push([
          chalk.yellow(tsToStr(ev.timesort)),
          chalk.bold(ev.name || '?'),
          chalk.cyan(ev.course?.fullname || '-'),
          chalk.dim(ev.action?.name || ev.eventtype || '-'),
        ]);
      }
      console.log(table.toString());
    }));
}
