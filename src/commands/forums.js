import chalk from 'chalk';
import boxen from 'boxen';
import { getClient } from '../client.js';
import { handleErrors, spinner, createTable, tsToStr } from '../ui.js';

export default function (program) {
  program
    .command('forums <courseId>')
    .description('List forums in a course, or show discussions with --forum-id')
    .option('-f, --forum-id <forumId>', 'Show discussions for a specific forum', parseInt)
    .action(handleErrors(async (courseId, options) => {
      const client = getClient();

      if (options.forumId) {
        await showDiscussions(client, options.forumId);
      } else {
        await showForums(client, parseInt(courseId));
      }
    }));
}

async function showForums(client, courseId) {
  const s = spinner('Fetching forums...').start();
  const forumList = await client.getForums([courseId]);
  s.stop();

  if (!forumList.length) {
    console.log(chalk.yellow('No forums found.'));
    return;
  }

  console.log(chalk.bold(`\n  Forums in Course ${courseId}\n`));

  const table = createTable(['ID', 'Forum', 'Type', 'Discussions']);
  for (const f of forumList) {
    let ftype = f.type || '?';
    if (ftype === 'news') ftype = chalk.yellow('Announcements');
    table.push([
      chalk.dim(String(f.id)),
      chalk.bold(f.name || '?'),
      ftype,
      String(f.numdiscussions || 0),
    ]);
  }
  console.log(table.toString());
  console.log(chalk.dim('\n  Use --forum-id to view discussions'));
}

async function showDiscussions(client, forumId) {
  const s = spinner('Fetching discussions...').start();
  const data = await client.getForumDiscussions(forumId);
  s.stop();

  const discussions = data.discussions || [];
  if (!discussions.length) {
    console.log(chalk.yellow('No discussions found.'));
    return;
  }

  for (const d of discussions.slice(0, 10)) {
    const name = d.name || '?';
    const author = d.userfullname || '?';
    const created = tsToStr(d.created);
    const message = (d.message || '').replace(/<[^>]+>/g, '').trim().slice(0, 500);

    console.log(boxen(
      `${chalk.dim(`${author} - ${created}`)}\n\n${message}`,
      {
        title: `  ${chalk.bold(name)}  `,
        titleAlignment: 'left',
        borderColor: 'blue',
        padding: 1,
        margin: { top: 1, bottom: 0, left: 2, right: 2 },
      },
    ));
  }
  console.log();
}
