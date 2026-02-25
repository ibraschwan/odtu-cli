import chalk from 'chalk';
import { getClient } from '../client.js';
import { handleErrors, spinner, moduleIcon } from '../ui.js';

export default function (program) {
  program
    .command('contents <courseId>')
    .description('Show sections and activities for a course')
    .action(handleErrors(async (courseId) => {
      const client = getClient();

      const s = spinner('Fetching course contents...').start();
      const sections = await client.getCourseContents(parseInt(courseId));
      s.stop();

      if (!sections.length) {
        console.log(chalk.yellow('No content found.'));
        return;
      }

      for (const section of sections) {
        const modules = section.modules || [];
        if (!modules.length) continue;

        const name = section.name || 'Unnamed Section';
        console.log(chalk.cyan.bold(`\n  ${name}`));

        modules.forEach((mod, i) => {
          const isLast = i === modules.length - 1;
          const prefix = isLast ? '  └── ' : '  ├── ';
          const icon = moduleIcon(mod.modname);
          const url = mod.url ? chalk.dim(` ${mod.url}`) : '';
          console.log(`${prefix}${icon} ${mod.name} ${chalk.dim(`(${mod.modname})`)}${url}`);
        });
      }
      console.log();
    }));
}
