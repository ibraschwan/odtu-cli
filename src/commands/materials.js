import { access, mkdir, stat, writeFile } from 'fs/promises';
import { dirname, extname, join, resolve } from 'path';
import { spawnSync } from 'child_process';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
import { APIError, getClient } from '../client.js';
import { handleErrors, spinner } from '../ui.js';

const clean = value => (value || '').replace(/\s+/g, ' ').trim();
const safeName = value => clean(value)
  .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
  .replace(/^\.+/, '') || 'file';

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function availablePath(directory, filename) {
  const extension = extname(filename);
  const stem = extension ? filename.slice(0, -extension.length) : filename;
  let candidate = join(directory, filename);
  for (let suffix = 2; await exists(candidate); suffix++) {
    candidate = join(directory, `${stem}-${suffix}${extension}`);
  }
  return candidate;
}

function filenameFromResponse(response, fallback) {
  const disposition = response.headers?.['content-disposition'] || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const basic = disposition.match(/filename="?([^";]+)"?/i);
  if (encoded) return safeName(decodeURIComponent(encoded[1]));
  if (basic) return safeName(basic[1]);
  try {
    const pathname = decodeURIComponent(new URL(response.finalUrl || response.config?.url).pathname);
    const tail = pathname.split('/').filter(Boolean).pop();
    if (tail?.includes('.')) return safeName(tail);
  } catch { /* use fallback */ }
  return safeName(fallback);
}

function isHtml(response) {
  return (response.headers?.['content-type'] || '').toLowerCase().includes('text/html');
}

function sectionLabel($, section, index) {
  const title = clean($(section).find('[data-for="section_title"]').first().text());
  const range = title.match(/(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s*-\s*\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+)/)?.[1];
  if (range) return `week-${String(index).padStart(2, '0')}_${safeName(range)}`;
  return index === 0 ? 'general' : `week-${String(index).padStart(2, '0')}_${safeName(title)}`;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') throw new Error(`${command} is not installed or not in PATH`);
  if (result.status !== 0) throw new Error(`${command} failed: ${clean(result.stderr || result.stdout)}`);
}

async function fetchResponse(client, url, retried = false) {
  const parsed = new URL(url, client.baseUrl);
  if (parsed.origin !== new URL(client.baseUrl).origin) {
    throw new APIError(`Refusing external download host: ${parsed.host}`);
  }
  const response = await client._request('GET', parsed.href, null, { responseType: 'arraybuffer' });
  if ((response.finalUrl || '').includes('/login/index.php')) {
    if (!retried && client._canAutoReLogin()) {
      await client._autoReLogin();
      return fetchResponse(client, url, true);
    }
    throw new Error('Session expired. Run: odtu login');
  }
  return response;
}

async function saveResponse(response, directory, fallback, sourceUrl, manifest) {
  await mkdir(directory, { recursive: true });
  const destination = await availablePath(directory, filenameFromResponse(response, fallback));
  await writeFile(destination, Buffer.from(response.data), { flag: 'wx' });
  manifest.push({ path: destination, sourceUrl, contentType: response.headers?.['content-type'] || '' });
  return destination;
}

async function downloadActivity(client, url, directory, fallback, manifest, seen) {
  const response = await fetchResponse(client, url);
  if (!isHtml(response)) return [await saveResponse(response, directory, fallback, url, manifest)];

  const $ = cheerio.load(Buffer.from(response.data).toString('utf8'));
  const links = new Set();
  $('a[href]').each((_, anchor) => {
    const parsed = new URL($(anchor).attr('href'), client.baseUrl);
    if (parsed.origin === new URL(client.baseUrl).origin && parsed.pathname.includes('/pluginfile.php/')) {
      links.add(parsed.href);
    }
  });
  const saved = [];
  for (const fileUrl of links) {
    if (seen.has(fileUrl)) continue;
    seen.add(fileUrl);
    const fileResponse = await fetchResponse(client, fileUrl);
    if (!isHtml(fileResponse)) saved.push(await saveResponse(fileResponse, directory, fallback, fileUrl, manifest));
  }
  return saved;
}

async function saveAnnouncements(client, $, courseRoot, seen, manifest) {
  const forum = $('li.activity.modtype_forum').filter((_, element) => /announcement/i.test(clean($(element).text()))).first();
  const forumUrl = forum.find('a[href*="/mod/forum/view.php"]').first().attr('href');
  if (!forumUrl) return 0;

  const forumHtml = await client.getPageHtml(new URL(forumUrl).pathname + new URL(forumUrl).search);
  const forumPage = cheerio.load(forumHtml);
  const discussions = new Map();
  forumPage('a[href*="/mod/forum/discuss.php"]').each((_, anchor) => {
    const parsed = new URL(forumPage(anchor).attr('href'), client.baseUrl);
    const id = parsed.searchParams.get('d');
    if (id && !parsed.searchParams.has('parent') && !discussions.has(id)) {
      discussions.set(id, { title: clean(forumPage(anchor).text()), url: parsed.href });
    }
  });

  const directory = join(courseRoot, 'announcements');
  const attachmentDir = join(directory, 'attachments');
  await mkdir(directory, { recursive: true });
  const lines = ['# Announcements', ''];
  for (const [id, discussion] of discussions) {
    const html = await client.getPageHtml(`/mod/forum/discuss.php?d=${id}`);
    const page = cheerio.load(html);
    const post = page('.forumpost').first();
    const subject = clean(post.find('.subject').first().text()) || discussion.title;
    const author = clean(post.find('.author').first().text());
    const body = post.find('.posting').first();
    const paragraphs = [];
    body.find('p, li').each((_, item) => {
      const text = clean(page(item).text());
      if (text && !paragraphs.includes(text)) paragraphs.push(text);
    });
    if (!paragraphs.length && clean(body.text())) paragraphs.push(clean(body.text()));
    lines.push(`## ${subject}`, '', author, '', ...paragraphs, '', `Source: ${discussion.url}`, '');

    const attachments = new Set();
    post.find('a[href]').each((_, anchor) => {
      const parsed = new URL(page(anchor).attr('href'), client.baseUrl);
      if (parsed.origin === new URL(client.baseUrl).origin && parsed.pathname.includes('/pluginfile.php/')) attachments.add(parsed.href);
    });
    for (const fileUrl of attachments) {
      if (seen.has(fileUrl)) continue;
      seen.add(fileUrl);
      const response = await fetchResponse(client, fileUrl);
      if (!isHtml(response)) await saveResponse(response, attachmentDir, `${subject}-attachment`, fileUrl, manifest);
    }
  }
  await writeFile(join(directory, 'all-announcements.md'), lines.join('\n'));
  return discussions.size;
}

async function convertAndMerge(courseRoot, manifest, mergeMode) {
  const weeksRoot = join(courseRoot, 'weeks');
  const byDirectory = new Map();
  for (const item of manifest) {
    const extension = extname(item.path).toLowerCase();
    if (!['.pdf', '.ppt', '.pptx'].includes(extension) || !item.path.startsWith(weeksRoot)) continue;
    let pdf = item.path;
    if (extension === '.ppt' || extension === '.pptx') {
      run('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', dirname(item.path), item.path]);
      pdf = item.path.slice(0, -extension.length) + '.pdf';
      await stat(pdf);
    }
    if (!byDirectory.has(dirname(item.path))) byDirectory.set(dirname(item.path), []);
    byDirectory.get(dirname(item.path)).push(pdf);
  }
  if (!mergeMode) return null;

  if (!byDirectory.size) throw new Error('No PDF or PowerPoint files found to merge');

  const directories = [...byDirectory.keys()].sort((a, b) => {
    if (a.endsWith('/general')) return -1;
    if (b.endsWith('/general')) return 1;
    return a.localeCompare(b, 'en', { numeric: true });
  });
  const weekly = [];
  for (const directory of directories) {
    const files = byDirectory.get(directory);
    if (!files.length) continue;
    const label = directory.split('/').pop();
    const output = join(directory, `${label}-merged.pdf`);
    run('pdfunite', [...files, output]);
    weekly.push(output);
  }
  if (mergeMode === 'weekly') return weekly;
  const finalPdf = join(courseRoot, 'all-weeks.pdf');
  run('pdfunite', [...weekly, finalPdf]);
  return finalPdf;
}

export default function (program) {
  program
    .command('materials <courseId>')
    .description('Archive course files and announcements with HTML fallback')
    .option('-o, --output <directory>', 'Parent output directory', 'ders')
    .option('--no-announcements', 'Skip the announcements forum')
    .option('--convert-pptx', 'Convert PPT/PPTX files to PDF with LibreOffice')
    .option('--merge <mode>', 'Merge PDFs: weekly or all', value => {
      if (!['weekly', 'all'].includes(value)) throw new Error('Merge mode must be weekly or all');
      return value;
    })
    .action(handleErrors(async (courseId, options) => {
      const id = Number(courseId);
      if (!Number.isInteger(id) || id <= 0) throw new Error('Course ID must be a positive integer');
      if (options.merge && !options.convertPptx) throw new Error('--merge requires --convert-pptx');

      const client = getClient();
      const progress = spinner('Reading course page...').start();
      const html = await client.getPageHtml(`/course/view.php?id=${id}`);
      const $ = cheerio.load(html);
      const pageTitle = clean($('title').text()).replace(/^Course:\s*/i, '').replace(/\s*\|.*$/, '');
      const courseName = safeName(pageTitle || `course-${id}`);
      const courseRoot = join(resolve(options.output), courseName);
      const weeksRoot = join(courseRoot, 'weeks');
      await mkdir(weeksRoot, { recursive: true });

      const manifest = [];
      const seen = new Set();
      const indexLines = [`# ${pageTitle || `Course ${id}`} — Content`, ''];
      const sections = $('li.course-section').toArray();
      for (let index = 0; index < sections.length; index++) {
        const section = sections[index];
        const label = sectionLabel($, section, index);
        const directory = join(weeksRoot, label);
        indexLines.push(`## ${label}`, '');
        for (const element of $(section).find('li.activity').toArray()) {
          const activity = $(element);
          const type = (activity.attr('class') || '').match(/modtype_([^ ]+)/)?.[1] || 'activity';
          const anchor = activity.find('a.aalink, a[href*="/mod/"]').first();
          if (!anchor.length) continue;
          const name = clean(anchor.text());
          const url = anchor.attr('href');
          indexLines.push(`- ${name} (${type}): ${url}`);
          if (['resource', 'folder', 'assign', 'turnitintooltwo'].includes(type)) {
            progress.text = `Downloading ${name}...`;
            try {
              await downloadActivity(client, url, directory, name.replace(/\s+File$/i, ''), manifest, seen);
            } catch (error) {
              console.error(chalk.yellow(`  skipped ${name}: ${error.message}`));
            }
          }
        }
        indexLines.push('');
      }
      await writeFile(join(courseRoot, 'content-index.md'), indexLines.join('\n'));

      let announcementCount = 0;
      if (options.announcements) {
        progress.text = 'Saving announcements...';
        announcementCount = await saveAnnouncements(client, $, courseRoot, seen, manifest);
      }
      await writeFile(join(courseRoot, 'download-manifest.json'), JSON.stringify(manifest, null, 2));

      let merged = null;
      if (options.convertPptx) {
        progress.text = 'Converting and merging PDFs...';
        merged = await convertAndMerge(courseRoot, manifest, options.merge || null);
      }
      progress.succeed(`Saved ${manifest.length} files and ${announcementCount} announcements`);
      console.log(chalk.cyan(`  ${courseRoot}`));
      if (merged) console.log(chalk.green(`  PDF: ${Array.isArray(merged) ? `${merged.length} weekly files` : merged}`));
    }));
}
