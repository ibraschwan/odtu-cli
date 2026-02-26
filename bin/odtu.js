#!/usr/bin/env node

import { Command } from 'commander';
import login from '../src/commands/login.js';
import logout from '../src/commands/logout.js';
import status from '../src/commands/status.js';
import switchCmd from '../src/commands/switch.js';
import courses from '../src/commands/courses.js';
import grades from '../src/commands/grades.js';
import assignments from '../src/commands/assignments.js';
import deadlines from '../src/commands/deadlines.js';
import contents from '../src/commands/contents.js';
import forums from '../src/commands/forums.js';
import announcements from '../src/commands/announcements.js';
import dashboard from '../src/commands/dashboard.js';
import transcript from '../src/commands/transcript.js';
import gpa from '../src/commands/gpa.js';
import curriculum from '../src/commands/curriculum.js';
import schedule from '../src/commands/schedule.js';
import profile from '../src/commands/profile.js';

const program = new Command();

program
  .name('odtu')
  .description('ODTU CLI - access your METU courses from the terminal')
  .version('2.0.0');

login(program);
logout(program);
status(program);
switchCmd(program);
courses(program);
grades(program);
assignments(program);
deadlines(program);
contents(program);
forums(program);
announcements(program);
dashboard(program);
transcript(program);
gpa(program);
curriculum(program);
schedule(program);
profile(program);

// Bare "odtu" with no subcommand → animated banner + help
if (process.argv.length <= 2) {
  const { showBanner } = await import('../src/ui.js');
  await showBanner();
  program.outputHelp();
  process.exit(0);
}

program.parse();
