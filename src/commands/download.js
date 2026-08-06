import { mkdir, writeFile, access } from 'fs/promises';
import { resolve, join } from 'path';
import chalk from 'chalk';
import { getClient } from '../client.js';
import { handleErrors, spinner } from '../ui.js';

function safeName(name) {
  return (name || 'download')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/^\.+/, '')
    .trim() || 'download';
}

async function availablePath(directory, filename) {
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const extension = dot > 0 ? filename.slice(dot) : '';
  let candidate = join(directory, filename);
  let suffix = 2;
  while (true) {
    try {
      await access(candidate);
      candidate = join(directory, `${stem}-${suffix}${extension}`);
      suffix++;
    } catch {
      return candidate;
    }
  }
}

export default function (program) {
  program
    .command('download <courseId> [moduleId]')
    .description('Download course and assignment files, optionally from one module')
    .option('-o, --output <directory>', 'Destination directory', 'downloads')
    .action(handleErrors(async (courseId, moduleId, options) => {
      const parsedCourseId = Number.parseInt(courseId, 10);
      const parsedModuleId = moduleId ? Number.parseInt(moduleId, 10) : null;
      if (!Number.isInteger(parsedCourseId) || (moduleId && !Number.isInteger(parsedModuleId))) {
        throw new Error('Course and module IDs must be integers');
      }

      const client = getClient();
      const s = spinner('Finding downloadable files...').start();
      const sections = await client.getCourseContents(parsedCourseId);
      const files = sections.flatMap(section => (section.modules || []))
        .filter(mod => parsedModuleId === null || mod.id === parsedModuleId)
        .flatMap(mod => (mod.contents || [])
          .filter(item => item.type === 'file' && item.fileurl)
          .map(item => ({ ...item, moduleName: mod.name })));

      if (!files.length) {
        s.stop();
        console.log(chalk.yellow('No downloadable files found. The activity may only contain an external link.'));
        return;
      }

      const output = resolve(options.output);
      await mkdir(output, { recursive: true });
      let downloaded = 0;
      for (const file of files) {
        s.text = `Downloading ${file.filename || file.moduleName}...`;
        const filename = safeName(file.filename || file.moduleName);
        const destination = await availablePath(output, filename);
        const data = await client.downloadFile(file.fileurl);
        await writeFile(destination, data, { flag: 'wx' });
        downloaded++;
        console.log(chalk.green('  saved ') + destination);
      }
      s.succeed(`Downloaded ${downloaded} file${downloaded === 1 ? '' : 's'} to ${output}`);
    }));
}
