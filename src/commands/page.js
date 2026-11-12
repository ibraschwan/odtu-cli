import chalk from 'chalk';
import boxen from 'boxen';
import { getClient } from '../client.js';
import { handleErrors, spinner, isJsonMode, emitJson } from '../ui.js';

export default function (program) {
  program
    .command('page <cmid>')
    .description('Read a Moodle Page activity (announcements, exam rules, guidelines)')
    .action(handleErrors(async (cmid) => {
      const id = parseInt(cmid, 10);
      if (!Number.isInteger(id) || id <= 0) throw new Error('Page module ID (cmid) must be a positive integer');

      const client = getClient();
      const s = spinner('Fetching page...').start();
      const page = await client.getPageContent(id);
      s.stop();

      if (isJsonMode()) {
        emitJson(page);
        return;
      }

      const lines = [
        chalk.cyan(page.courseTitle),
        '',
        page.text || chalk.dim('(empty page)'),
      ];
      if (page.links.length) {
        lines.push('', chalk.bold('Links:'));
        for (const l of page.links) lines.push(`  - ${l.text || l.url}: ${l.url}`);
      }
      if (page.files.length) {
        lines.push('', chalk.bold('Files:'));
        for (const f of page.files) lines.push(`  - ${f.text || f.url}: ${f.url}`);
      }

      console.log(boxen(lines.join('\n'), {
        title: `  ${chalk.bold(page.title)}  `,
        titleAlignment: 'left',
        borderColor: 'green',
        padding: 1,
        margin: { top: 1, bottom: 1, left: 2, right: 2 },
      }));
    }));
}
