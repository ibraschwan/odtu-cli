import { mkdir, writeFile, access } from 'fs/promises';
import { resolve, join } from 'path';
import chalk from 'chalk';
import { getClient } from '../client.js';
import { handleErrors, spinner, isJsonMode, emitJson } from '../ui.js';

function safeName(name) {
  return (name || 'download')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/^\.+/, '')
    .trim() || 'download';
}

function decodeHeaderFilename(raw) {
  if (/[\x80-\xff]/.test(raw)) {
    const utf8 = Buffer.from(raw, 'latin1').toString('utf8');
    if (!utf8.includes('\ufffd')) return utf8;
  }
  return raw;
}

function resolveFilename(downloadResult, fallback) {
  const disposition = downloadResult.contentDisposition || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const basic = disposition.match(/filename="?([^";]+)"?/i);
  if (encoded) return safeName(decodeURIComponent(encoded[1]));
  if (basic) return safeName(decodeHeaderFilename(basic[1]));
  try {
    const pathname = decodeURIComponent(new URL(downloadResult.finalUrl).pathname);
    const tail = pathname.split('/').filter(Boolean).pop();
    if (tail && tail.includes('.')) return safeName(tail);
  } catch { /* fallback */ }
  return safeName(fallback);
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
      const mods = sections
        .flatMap(section => (section.modules || []))
        .filter(mod => parsedModuleId === null || mod.id === parsedModuleId)
        .filter(mod => (mod.contents && mod.contents.length) || ['resource', 'folder', 'assign', 'turnitintooltwo'].includes(mod.modname));

      const files = [];
      for (const mod of mods) {
        const resolved = await client.resolveActivityFiles(mod);
        files.push(...resolved);
      }

      if (!files.length) {
        s.stop();
        if (isJsonMode()) {
          emitJson({ courseId: parsedCourseId, moduleId: parsedModuleId, downloaded: [] });
          return;
        }
        console.log(chalk.yellow('No downloadable files found. The activity may only contain an external link.'));
        return;
      }

      const output = resolve(options.output);
      await mkdir(output, { recursive: true });
      const saved = [];
      for (const file of files) {
        s.text = `Downloading ${file.filename || file.moduleName}...`;
        const dl = await client.downloadFile(file.fileurl);
        const filename = resolveFilename(dl, file.filename || file.moduleName);
        const destination = await availablePath(output, filename);
        await writeFile(destination, dl.buffer, { flag: 'wx' });
        saved.push({ path: destination, sourceUrl: file.fileurl, bytes: dl.buffer.length });
        if (!isJsonMode()) console.log(chalk.green('  saved ') + destination);
      }
      s.succeed(`Downloaded ${saved.length} file${saved.length === 1 ? '' : 's'} to ${output}`);
      if (isJsonMode()) {
        emitJson({ courseId: parsedCourseId, moduleId: parsedModuleId, output, downloaded: saved });
      }
    }));
}
