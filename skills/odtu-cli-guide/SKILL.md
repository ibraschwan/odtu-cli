---
name: odtu-cli-guide
description: >
  Use this skill whenever the user asks about METU (ODTÜ) courses, ODTUClass/Moodle assignments,
  submission status, grades, GPA, transcript, curriculum, weekly schedule, attendance, announcements,
  or course materials. Triggers on "check my grades", "what's due this week", "show my schedule",
  "transcript", "GPA", "attendance", "assignment details", "download course materials", "odtu",
  "odtuclass", "metu", "sais", or Turkish queries like "derslerim", "ödevlerim", "notlarım",
  "devamsızlık", "duyurular", "transkript".
metadata:
  version: "2.1.2"
---

# ODTU CLI Agent Guide

`odtu` is a terminal tool for METU (Middle East Technical University) students providing unified access to:
1. **ODTUClass (Moodle)** — courses, grades, assignments (+ submission status & full instructions), deadlines, forums, announcements, pages, attendance, file downloads/archives, and arbitrary authenticated URLs.
2. **Student Portal (`student.metu.edu.tr` / SAIS)** — transcript, GPA, curriculum completion, weekly schedule, profile, and financial status.

## Always Use `--json`

Every `odtu` command accepts the global `--json` flag (`odtu --json <cmd>` or `odtu <cmd> --json`).
In agent workflows, **always pass `--json`**:
- Suppresses ANSI styling, ASCII tables, and spinners.
- Emits structured JSON to stdout (exit `0`).
- Emits structured error JSON to stderr (`{ "ok": false, "error": "...", "type": "..." }`, exit `1`).

## Session & Login

- **Session files:** `~/.odtuclass/session.json` (Moodle) and `~/.odtuclass/student-session.json` (SAIS), mode `0600`.
- **Interactive login:** `odtu login` requires an interactive terminal (TTY) for arrow-key prompts. Instruct the user to run `odtu login` in their terminal if unauthenticated, or verify with `odtu status --json`.

## Command Reference

### Session Management

| Command | Purpose |
|---|---|
| `odtu status --json` | Verify auth, user info, semester |
| `odtu login` | Interactive login wizard (year, semester, credentials) |
| `odtu logout --json` | Clear saved session |
| `odtu switch` | Switch academic semester |

### ODTUClass Commands

| Command | Purpose | Key Options |
|---|---|---|
| `odtu courses --json` | List enrolled courses with IDs | `-f all\|inprogress\|future\|past` |
| `odtu grades [courseId] --json` | Course letter overview, or item/weight/average breakdown | — |
| `odtu assignments [courseId] --json` | List assignments/quizzes with `cmid`, `duedate`, `submissionStatus` | — |
| `odtu assignment <cmid> --json` | Full assignment instructions, attachments, due date, submission status & files | — |
| `odtu deadlines [courseId] --json` | Upcoming calendar events | `-d <days>` (default: `14`) |
| `odtu announcements [courseId] --json` | Recent announcements across all or one course | `-n <count>` (default: `5`), `-f all\|inprogress` |
| `odtu contents <courseId> --json` | Sections and activity modules (includes HTML fallback if Moodle WS is disabled) | — |
| `odtu forums <courseId> --json` | List forums, discussions (`-f`), or full posts (`-d`) | `-f <forumId>`, `-d <discussionId>` |
| `odtu page <cmid> --json` | Read a Moodle Page activity (text, links, files) | — |
| `odtu attendance [courseId] --json` | Attendance session rows and summary per course | — |
| `odtu download <courseId> [moduleId] --json` | Download files from a module or whole course | `-o <dir>` (default: `downloads`) |
| `odtu materials <courseId> --json` | Full course archive (files, external links, announcements) | `-o <dir>`, `--no-announcements`, `--convert-pptx`, `--merge weekly\|all` |
| `odtu fetch <urlOrPath> --json` | Fetch any authenticated ODTUClass URL/path (text/links or binary save) | `--raw`, `-o <file>` |
| `odtu dashboard --json` | Combined semester info, course list, and 7-day events | — |

### Student Portal (SAIS — `student.metu.edu.tr`) Commands

| Command | Purpose |
|---|---|
| `odtu transcript --json` | Full transcript across all semesters (credits, grades, ECTS, GPA) |
| `odtu gpa --json` | Semester-by-semester GPA, cumulative GPA, standing |
| `odtu curriculum --json` | Curriculum checklist (passed / failed / remaining courses) |
| `odtu schedule --json` | Weekly course grid by time slot |
| `odtu profile --json` | Student info, registered courses, tuition/library financial status |

## Common Agent Workflows

### 1. Check What's Due & Verify Submission Status

```bash
odtu deadlines -d 14 --json
odtu assignments --json
odtu assignment <cmid> --json
```

### 2. Read Course Content, Syllabi, or Rules Inside Moodle Modules

```bash
odtu courses --json                    # get courseId
odtu contents <courseId> --json        # find cmid and modname (assign/page/resource/forum)
odtu page <cmid> --json                # read Page module
odtu download <courseId> <cmid> -o ./files --json
odtu fetch "/mod/forum/discuss.php?d=1234" --json
```

### 3. Academic Record & Attendance Snapshot

```bash
odtu grades <courseId> --json
odtu attendance <courseId> --json
odtu gpa --json
odtu schedule --json
```

## Notes

- **HTML fallbacks:** When METU restricts Moodle Web Service endpoints (such as `core_course_get_contents` or `mod_assign_get_assignments`), `odtu` falls back transparently to authenticated HTML scraping.
- For detailed `--json` response shapes of every command, see [references/command-outputs.md](references/command-outputs.md).
