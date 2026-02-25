/**
 * Shared UI helpers: banner, spinners, tables, formatters.
 */

import chalk from 'chalk';
import ora from 'ora';
import gradient from 'gradient-string';
import boxen from 'boxen';
import Table from 'cli-table3';

const TZ_OFFSET = 3 * 60; // Istanbul UTC+3 in minutes

const odtuGradient = gradient(['#00d2ff', '#7b2ff7']);

const BANNER_ART = [
  '                          :',
  ' :                       ::          ___       ___       ___       ___',
  ' ::          :          ::          /\\  \\     /\\  \\     /\\  \\     /\\__\\',
  ':::  ::     ::         :::         /::\\  \\   /::\\  \\    \\:\\  \\   /:/ _/_',
  ':::::::    :::::::::::::::        /:/\\:\\__\\ /:/\\:\\__\\   /::\\__\\ /:/_/\\__\\',
  ' ::::::::::::::::::::::::         \\:\\/:/  / \\:\\/:/  /  /:/\\/__/ \\:\\/:/  /',
  ' :::::::::::::::::::::             \\::/  /   \\::/  /   \\/__/     \\::/  /',
  '         :::::                      \\/__/     \\/__/               \\/__/',
  '         :::',
  '         :::',
  '        ::::',
  '        :::     welcome to odtu cli v1.0         built with <3 by ibracob.dev',
];

export async function showBanner({ animate = true } = {}) {
  const lines = BANNER_ART;
  const full = lines.join('\n');

  if (!animate || !process.stdout.isTTY) {
    console.log('\n' + odtuGradient(full) + '\n');
    return;
  }

  // Collect all non-space character positions
  const positions = [];
  for (let row = 0; row < lines.length; row++) {
    for (let col = 0; col < lines[row].length; col++) {
      if (lines[row][col] !== ' ') {
        positions.push([row, col]);
      }
    }
  }

  // Fisher-Yates shuffle for random dithering order
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  // Mutable grid starts as all spaces
  const maxLen = Math.max(...lines.map(l => l.length));
  const grid = lines.map(() => new Array(maxLen).fill(' '));

  const totalChars = positions.length;
  const frames = 20;
  const charsPerFrame = Math.ceil(totalChars / frames);
  const frameDelay = 45;

  // Hide cursor, reserve space
  process.stdout.write('\x1B[?25l\n');
  for (let i = 0; i < lines.length; i++) process.stdout.write('\n');

  let revealed = 0;
  for (let frame = 0; frame < frames; frame++) {
    // Reveal a random batch of characters
    const end = Math.min(revealed + charsPerFrame, totalChars);
    for (let i = revealed; i < end; i++) {
      const [row, col] = positions[i];
      grid[row][col] = lines[row][col];
    }
    revealed = end;

    // Move cursor up and redraw
    process.stdout.write(`\x1B[${lines.length}A\r`);
    const display = grid.map(row => row.join('')).join('\n');
    process.stdout.write(odtuGradient(display) + '\n');

    await new Promise(r => setTimeout(r, frameDelay));
  }

  // Show cursor
  process.stdout.write('\x1B[?25h');
  console.log();
}

export async function typewriter(text, delay = 30) {
  for (const char of text) {
    process.stdout.write(char);
    await new Promise(r => setTimeout(r, delay));
  }
  process.stdout.write('\n');
}

export function spinner(text) {
  return ora({ text, spinner: 'dots' });
}

export function successBox(content, title) {
  console.log(boxen(content, {
    padding: 1,
    margin: { top: 1, bottom: 1, left: 2, right: 2 },
    borderStyle: 'double',
    borderColor: 'green',
    title: title ? `  ${title}  ` : undefined,
    titleAlignment: 'center',
  }));
}

export function infoBox(content, title, color = 'blue') {
  console.log(boxen(content, {
    padding: 1,
    margin: { top: 0, bottom: 0, left: 2, right: 2 },
    borderStyle: 'round',
    borderColor: color,
    title: title ? `  ${title}  ` : undefined,
    titleAlignment: 'center',
  }));
}

export function createTable(head, options = {}) {
  const { noBorder = false } = options;

  if (noBorder) {
    return new Table({
      head: head.map(h => chalk.dim(h)),
      chars: {
        'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
        'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
        'left': '  ', 'left-mid': '', 'mid': '', 'mid-mid': '',
        'right': '', 'right-mid': '', 'middle': '  ',
      },
      style: { head: [], 'padding-left': 0, 'padding-right': 1 },
    });
  }

  return new Table({
    head: head.map(h => chalk.cyan(h)),
    style: { head: [] },
  });
}

export function tsToStr(ts, fmt) {
  if (!ts) return '-';
  const date = new Date(ts * 1000);
  const istanbul = new Date(date.getTime() + (TZ_OFFSET + date.getTimezoneOffset()) * 60000);
  const y = istanbul.getFullYear();
  const mo = String(istanbul.getMonth() + 1).padStart(2, '0');
  const d = String(istanbul.getDate()).padStart(2, '0');
  const h = String(istanbul.getHours()).padStart(2, '0');
  const mi = String(istanbul.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

export function moduleIcon(modname) {
  const icons = {
    assign: chalk.red('>'),
    quiz: chalk.magenta('?'),
    forum: chalk.blue('#'),
    resource: chalk.green('~'),
    url: chalk.cyan('@'),
    page: chalk.white('='),
    folder: chalk.yellow('/'),
    book: chalk.green('B'),
    label: chalk.dim('-'),
    turnitintooltwo: chalk.red('T'),
    choicegroup: chalk.magenta('C'),
  };
  return icons[modname] || chalk.dim('*');
}

export function guessSemester() {
  const month = new Date().getMonth() + 1;
  if (month >= 9 || month === 1) return 'f';
  if (month >= 2 && month <= 6) return 's';
  return 'u';
}

// Academic year starts in September.
// Sep 2025 → 2025, Feb 2026 → 2025, Aug 2026 → 2025
export function currentAcademicYear() {
  const now = new Date();
  const month = now.getMonth() + 1;
  return month >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

export function academicYearLabel(startYear) {
  return `${startYear}-${startYear + 1}`;
}

export function semesterLabel(code) {
  const labels = { f: 'Fall', s: 'Spring', u: 'Summer' };
  return labels[code] || code.toUpperCase();
}

export function semesterArt(code) {
  const art = {
    f: chalk.yellow('~ Fall ~'),
    s: chalk.green('~ Spring ~'),
    u: chalk.red('~ Summer ~'),
  };
  return art[code] || '';
}

export function handleErrors(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      if (e.name === 'AuthError') {
        console.error(chalk.red.bold('Auth error: ') + e.message);
      } else if (e.name === 'APIError') {
        console.error(chalk.red.bold('API error: ') + e.message);
      } else {
        console.error(chalk.red.bold('Error: ') + e.message);
      }
      process.exit(1);
    }
  };
}
