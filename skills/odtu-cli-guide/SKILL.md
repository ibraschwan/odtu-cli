---
name: ODTU CLI Agent Guide
description: >
  This skill provides guidance for using the ODTU CLI tool to access METU university
  academic data (ODTUClass/Moodle and Student Portal). It should be used when the user asks to
  "check my grades", "what courses am I taking", "show my GPA", "what's due this week",
  "check my transcript", "show my schedule", "show my curriculum progress", "check deadlines",
  "check announcements", "when is my next exam", "what classes do I have today",
  "how many credits do I have", "am I passing", "check my tuition debt",
  "help me with odtu cli", "use odtu", "run odtu commands", "check my student portal",
  or "organize my school tasks". Also triggers when the user mentions "odtu", "odtuclass",
  "metu", "moodle grades", "student portal", "university transcript", or "course schedule".
version: 2.0.0
---

# ODTU CLI Agent Guide

ODTU CLI (`odtu`) is a terminal tool for METU (Middle East Technical University) students. It provides
access to two university systems through a single CLI: **ODTUClass** (Moodle - courses, grades,
deadlines, forums) and the **Student Portal** (transcript, GPA, curriculum, schedule, profile).

## Prerequisites

Before running any command, ensure the CLI is installed and authenticated:

```bash
npm install -g odtu
odtu login    # Interactive - requires TTY for arrow-key prompts and password input
```

`odtu login` authenticates with both systems in one step. If already logged in, verify with `odtu status`.

**Important:** `odtu login` is interactive and requires user input (arrow keys, password).
Never run it programmatically. Instead, instruct the user to run `odtu login` in their terminal
and confirm when done. All other `odtu` commands are non-interactive and safe to run directly.

**Session files:** `~/.odtuclass/session.json` (Moodle) and `~/.odtuclass/student-session.json` (Portal).
Sessions auto-refresh when credentials are saved. If a command fails with "Auth error", re-run `odtu login`.

## Command Reference

### Session Management

| Command | Purpose |
|---------|---------|
| `odtu login` | Interactive login wizard (year, semester, credentials) |
| `odtu logout` | Clear all saved sessions |
| `odtu status` | Check if current session is valid |
| `odtu switch` | Switch to a different semester |

### ODTUClass Commands (per-semester Moodle data)

| Command | Purpose | Key Options |
|---------|---------|-------------|
| `odtu courses` | List enrolled courses with IDs | `-f all\|inprogress\|future\|past` (default: all) |
| `odtu grades` | Grades overview (all courses) | — |
| `odtu grades <courseId>` | Detailed grades for one course | — |
| `odtu assignments [courseId]` | List assignments and quizzes | — |
| `odtu deadlines [courseId]` | Upcoming events | `-d <days>` (default: 14) |
| `odtu announcements [courseId]` | Course announcements | `-n <count>` (default: 5) |
| `odtu contents <courseId>` | Course sections and materials tree | — |
| `odtu forums <courseId>` | Forum list or discussions | `-f <forumId>` |
| `odtu dashboard` | Full overview (courses + 7-day events) | — |

### Student Portal Commands (university-wide academic record)

| Command | Purpose |
|---------|---------|
| `odtu transcript` | Full transcript: every semester, course, grade, ECTS, cumulative GPA |
| `odtu gpa` | Semester-by-semester GPA history with standing |
| `odtu curriculum` | Curriculum completion tracker (passed/failed/remaining) |
| `odtu schedule` | Weekly course schedule grid |
| `odtu profile` | Student info, registered courses, tuition/library debt |

## Workflow Patterns

### Getting Course IDs

Many commands accept a `courseId`. Obtain IDs by running `odtu courses` first — the ID column contains
the integer needed for subsequent commands.

### Checking Academic Standing

```bash
odtu gpa            # cumulative GPA + standing (SATISFACTORY/UNSATISFACTORY/PROBATION)
odtu curriculum     # completion percentage and remaining courses
odtu transcript     # full grade history across all semesters
```

### Checking Upcoming Work

```bash
odtu deadlines -d 7        # everything due in the next 7 days
odtu assignments            # all assignments with due dates
odtu announcements -n 10   # recent announcements across all courses
```

### Deep Dive into a Course

```bash
odtu courses                # get courseId
odtu grades <courseId>      # detailed grade breakdown (items, weights, percentages)
odtu contents <courseId>    # sections, modules, materials
odtu forums <courseId>      # forum discussions
odtu announcements <courseId> -n 20
```

## Programmatic Notes

- All commands exit `0` on success, `1` on error
- Error output goes to stderr with prefixes: `Auth error:`, `API error:`, `Error:`
- `odtu login` requires an interactive terminal (TTY) — cannot be automated
- If sessions expire and credentials are saved, commands auto-retry after re-login
- Output is formatted tables and boxes — parse the text content, not ANSI escape codes
- Student Portal commands fetch a full HTML page per call (~185KB) — avoid calling them in rapid loops

## Grade Scale Reference

| Grade | Standing |
|-------|----------|
| AA, BA, BB | Good (green) |
| CB, CC | Passing (yellow) |
| DC, DD | Low passing (yellow) |
| FD, FF | Failing (red) |
| S, EX, P | Special pass (green) |
| W | Withdrawn (gray) |
| NA | Not available (red) |

## Semester Codes

Academic year is the starting calendar year. Semester codes: `f` = Fall, `s` = Spring, `u` = Summer.
Example: Fall 2025-2026 → year `2025`, semester `f`.
The ODTUClass domain follows the pattern: `odtuclass2025f.metu.edu.tr`.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "Not logged in" | No session file | Run `odtu login` |
| "Auth error" | Session expired, no saved credentials | Run `odtu login` |
| "Could not get Student Information package" | Portal token expired or invalid | Run `odtu login` to refresh |
| "Student Information redirect failed" | Portal proxy flow broken | Run `odtu login`, retry |
| "API error" | Moodle API returned error | Check `odtu status`, re-login if needed |

## Additional Resources

### Reference Files

For detailed command output formats and data structures:
- **`references/command-outputs.md`** — Exact output format of every command with field descriptions
