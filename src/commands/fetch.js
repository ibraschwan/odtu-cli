import { writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import chalk from 'chalk';
import { getClient } from '../client.js';
import { handleErrors, spinner, isJsonMode, emitJson } from '../ui.js';

export default function (program) {
  program
    .command('fetch <urlOrPath>')
    .description('Fetch any authenticated ODTUClass URL/path (text, links, or download binary)')
    .option('--raw', 'Include raw HTML in output')
    .option('-o, --out <file>', 'Save response bytes/text to a local file')
    .action(handleErrors(async (urlOrPath, options) => {
      const client = getClient();
      const s = spinner('Fetching resource...').start();
      const res = await client.fetchResource(urlOrPath);
      s.stop();

      if (options.out) {
        const dest = resolve(options.out);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, res.isBinary ? res.buffer : res.raw);
        if (isJsonMode()) {
          emitJson({
            ok: true,
            url: res.url,
            contentType: res.contentType,
            savedTo: dest,
            bytes: res.isBinary ? res.buffer.length : Buffer.byteLength(res.raw, 'utf8'),
          });
          return;
        }
        console.log(chalk.green(`Saved to ${dest}`));
        return;
      }

      if (res.isBinary) {
        throw new Error(`Binary response (${res.contentType}); pass --out <file> to save it.`);
      }

      if (isJsonMode()) {
        const payload = {
          url: res.url,
          contentType: res.contentType,
          title: res.title || '',
          text: res.text || '',
          links: res.links || [],
          files: res.files || [],
        };
        if (options.raw) payload.raw = res.raw;
        emitJson(payload);
        return;
      }

      if (options.raw) {
        console.log(res.raw);
        return;
      }

      if (res.title) console.log(chalk.bold.cyan(`\n  ${res.title}\n`));
      console.log(res.text);
      if (res.files?.length) {
        console.log(chalk.bold('\nFiles:'));
        for (const f of res.files) console.log(`  - ${f.text || f.url}: ${f.url}`);
      }
      if (res.links?.length) {
        console.log(chalk.bold('\nLinks:'));
        for (const l of res.links.slice(0, 30)) console.log(`  - ${l.text || l.url}: ${l.url}`);
      }
    }));
}
