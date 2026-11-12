import chalk from 'chalk';
import boxen from 'boxen';
import { getClient } from '../client.js';
import { handleErrors, spinner, isJsonMode, emitJson } from '../ui.js';

export default function (program) {
  program
    .command('assignment <cmid>')
    .description('Show full assignment instructions, attachments, due date, and submission status')
    .action(handleErrors(async (cmid) => {
      const id = parseInt(cmid, 10);
      if (!Number.isInteger(id) || id <= 0) throw new Error('Assignment module ID (cmid) must be a positive integer');

      const client = getClient();
      const s = spinner('Fetching assignment details...').start();
      const detail = await client.getAssignmentDetail(id);
      s.stop();

      if (isJsonMode()) {
        emitJson(detail);
        return;
      }

      const lines = [
        chalk.cyan(detail.courseTitle),
        '',
        detail.opened ? `${chalk.dim('Opened:')} ${detail.opened}` : null,
        detail.due ? `${chalk.dim('Due:')}    ${chalk.yellow(detail.due)}` : null,
        detail.submission.status ? `${chalk.dim('Status:')} ${detail.submission.status}` : null,
        detail.submission.gradingStatus ? `${chalk.dim('Grade:')}  ${detail.submission.gradingStatus}${detail.submission.grade ? ` (${detail.submission.grade})` : ''}` : null,
        detail.submission.timeRemaining ? `${chalk.dim('Time:')}   ${detail.submission.timeRemaining}` : null,
        '',
        detail.description || chalk.dim('(no description)'),
      ].filter(x => x !== null);

      if (detail.attachments.length) {
        lines.push('', chalk.bold('Attachments:'));
        for (const a of detail.attachments) lines.push(`  - ${a.name}: ${a.url}`);
      }
      if (detail.submission.files?.length) {
        lines.push('', chalk.bold('Submitted files:'));
        for (const f of detail.submission.files) lines.push(`  - ${f.name}: ${f.url}`);
      }
      if (detail.submission.feedback) {
        lines.push('', `${chalk.bold('Feedback:')} ${detail.submission.feedback}`);
      }

      console.log(boxen(lines.join('\n'), {
        title: `  ${chalk.bold(detail.title)}  `,
        titleAlignment: 'left',
        borderColor: 'cyan',
        padding: 1,
        margin: { top: 1, bottom: 1, left: 2, right: 2 },
      }));
    }));
}
