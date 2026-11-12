import chalk from 'chalk';
import boxen from 'boxen';
import { getClient } from '../client.js';
import { handleErrors, spinner, createTable, tsToStr, isJsonMode, emitJson } from '../ui.js';

export default function (program) {
  program
    .command('forums <courseId>')
    .description('List forums in a course, or show discussions/posts')
    .option('-f, --forum-id <forumId>', 'Show discussions for a specific forum', parseInt)
    .option('-d, --discussion-id <discussionId>', 'Show full posts for a specific discussion', parseInt)
    .action(handleErrors(async (courseId, options) => {
      const client = getClient();

      if (options.discussionId) {
        await showDiscussionDetail(client, options.discussionId);
      } else if (options.forumId) {
        await showDiscussions(client, options.forumId);
      } else {
        await showForums(client, parseInt(courseId, 10));
      }
    }));
}

async function showForums(client, courseId) {
  const s = spinner('Fetching forums...').start();
  const forumList = await client.getForums([courseId]);
  s.stop();

  if (isJsonMode()) {
    emitJson({ courseId, forums: forumList });
    return;
  }

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
      f.numdiscussions !== null && f.numdiscussions !== undefined ? String(f.numdiscussions) : '-',
    ]);
  }
  console.log(table.toString());
  console.log(chalk.dim('\n  Use --forum-id to view discussions'));
}

async function showDiscussions(client, forumId) {
  const s = spinner('Fetching discussions...').start();
  const data = await client.getForumDiscussions(forumId);
  const discussions = data.discussions || [];

  // Enrich HTML-scraped discussions with body if requested in JSON mode
  if (isJsonMode()) {
    for (const d of discussions.slice(0, 15)) {
      if (!d.message && (d.discussion || d.id)) {
        try {
          const detail = await client.getDiscussionDetail(d.discussion || d.id);
          d.posts = detail.posts;
          if (detail.posts[0]) d.message = detail.posts[0].message;
        } catch { /* ignore */ }
      }
    }
    s.stop();
    emitJson({ forumId, discussions });
    return;
  }

  s.stop();

  if (!discussions.length) {
    console.log(chalk.yellow('No discussions found.'));
    return;
  }

  for (const d of discussions.slice(0, 10)) {
    const name = d.name || '?';
    const author = d.userfullname || '?';
    const created = d.created ? tsToStr(d.created) : (d.dateText || '-');
    const message = (d.message || '').replace(/<[^>]+>/g, '').trim().slice(0, 500);

    console.log(boxen(
      `${chalk.dim(`${author} - ${created} (id: ${d.discussion || d.id})`)}\n\n${message || chalk.dim('(use --discussion-id to read full post)')}`,
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

async function showDiscussionDetail(client, discussionId) {
  const s = spinner('Fetching discussion posts...').start();
  const detail = await client.getDiscussionDetail(discussionId);
  s.stop();

  if (isJsonMode()) {
    emitJson(detail);
    return;
  }

  if (!detail.posts.length) {
    console.log(chalk.yellow('No posts found.'));
    return;
  }

  for (const p of detail.posts) {
    console.log(boxen(
      `${chalk.dim(`${p.author} - ${p.dateText}`)}\n\n${p.message}`,
      {
        title: `  ${chalk.bold(p.subject || `Discussion ${discussionId}`)}  `,
        titleAlignment: 'left',
        borderColor: 'blue',
        padding: 1,
        margin: { top: 1, bottom: 0, left: 2, right: 2 },
      },
    ));
  }
  console.log();
}
