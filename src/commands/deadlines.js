import chalk from 'chalk';
import { getClient } from '../client.js';
import { handleErrors, spinner, createTable, tsToStr, isJsonMode, emitJson } from '../ui.js';

export default function (program) {
  program
    .command('deadlines [courseId]')
    .description('Show upcoming deadlines and events')
    .option('-d, --days <days>', 'Number of days ahead to look', '14')
    .action(handleErrors(async (courseId, options) => {
      const client = getClient();
      const days = parseInt(options.days, 10);
      const now = Math.floor(Date.now() / 1000);
      const end = now + (days * 86400);

      const s = spinner('Fetching events...').start();
      let data;
      if (courseId) {
        data = await client.getCalendarEventsByCourse(parseInt(courseId, 10), 50);
      } else {
        data = await client.getCalendarEvents(now, end, 50);
      }
      s.stop();

      const events = (data.events || []).sort((a, b) => (a.timesort || 0) - (b.timesort || 0));

      if (isJsonMode()) {
        emitJson({
          days,
          events: events.map(ev => ({
            id: ev.id,
            name: ev.name || '?',
            timesort: ev.timesort || 0,
            date: tsToStr(ev.timesort),
            courseId: ev.course?.id || null,
            courseName: ev.course?.fullname || '-',
            action: ev.action?.name || ev.eventtype || '-',
            url: ev.url || ev.action?.url || '',
          })),
        });
        return;
      }

      if (!events.length) {
        console.log(chalk.yellow(`No events in the next ${days} days.`));
        return;
      }

      console.log(chalk.bold(`\n  Upcoming Events (next ${days} days)\n`));

      const table = createTable(['Date', 'Event', 'Course', 'Type']);
      for (const ev of events) {
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
