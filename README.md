# odtu

Access your METU courses, transcript, GPA, and curriculum right from the terminal.

```
                          :
 :                       ::          ___       ___       ___       ___
 ::          :          ::          /\  \     /\  \     /\  \     /\__\
:::  ::     ::         :::         /::\  \   /::\  \    \:\  \   /:/ _/_
:::::::    :::::::::::::::        /:/\:\__\ /:/\:\__\   /::\__\ /:/_/\__\
 ::::::::::::::::::::::::         \:\/:/  / \:\/:/  /  /:/\/__/ \:\/:/  /
 :::::::::::::::::::::             \::/  /   \::/  /   \/__/     \::/  /
         :::::                      \/__/     \/__/               \/__/
         :::
         :::
        ::::
        :::     welcome to odtu cli v2.0         built with <3 by ibracob.dev
```

## Install

```bash
npm install -g odtu
```

## Quick Start

```bash
odtu login        # interactive wizard - pick year, semester, enter credentials
odtu courses      # see your courses
odtu grades       # check your grades
odtu transcript   # full university transcript
odtu gpa          # GPA history with visual chart
odtu curriculum   # curriculum progress tracker
odtu profile      # student profile + financial status
```

## All Commands

### ODTUClass (Moodle)

| Command | Description |
|---------|-------------|
| `odtu login` | Interactive login wizard with arrow-key selection |
| `odtu courses` | List enrolled courses (`-f inprogress\|past\|future\|all`) |
| `odtu grades` | Grades overview across all courses |
| `odtu grades <id>` | Detailed grade breakdown for a course |
| `odtu assignments` | All assignments across courses |
| `odtu assignments <id>` | Assignments for a specific course |
| `odtu deadlines` | Upcoming events, next 14 days (`-d 30` for 30 days) |
| `odtu deadlines <id>` | Deadlines for a specific course |
| `odtu announcements` | Announcements across all active courses |
| `odtu announcements <id>` | Announcements for one course (`-n 10` for more) |
| `odtu contents <id>` | Course sections & activities as a tree |
| `odtu forums <id>` | Forums in a course |
| `odtu forums <id> -f <fid>` | Discussions in a specific forum |
| `odtu dashboard` | Full overview: active courses + upcoming events |

### Student Portal (student.metu.edu.tr)

| Command | Description |
|---------|-------------|
| `odtu transcript` | Full university transcript - all semesters, courses, grades, ECTS |
| `odtu gpa` | Semester-by-semester GPA breakdown with visual progress bar |
| `odtu curriculum` | Curriculum completion tracker (completed/failed/not taken) |
| `odtu schedule` | Weekly course schedule grid |
| `odtu profile` | Student profile, registered courses, tuition debt, portal services |

### Session

| Command | Description |
|---------|-------------|
| `odtu` | Show animated banner + help |
| `odtu switch` | Change to a different semester |
| `odtu status` | Check current session status |
| `odtu logout` | Clear saved session and credentials |

## Features

- Two data sources in one CLI: ODTUClass (Moodle) + Student Portal
- Arrow-key year & semester selection (no typing numbers)
- Dithering ASCII banner animation on startup
- Auto re-login when session expires
- Gradient-colored terminal UI with animated spinners
- GPA visualization with progress bars
- Curriculum completion tracking with percentage
- Color-coded grades (green for passing, red for failing)

## Security & Data Storage

Your data is stored locally on your machine. Nothing is sent anywhere except to METU's own servers.

### What is saved

Two files in `~/.odtuclass/`:

**`session.json`** - ODTUClass (Moodle) session

| Field | Purpose |
|-------|---------|
| `cookies` | Moodle session cookie |
| `sesskey` | Moodle CSRF token |
| `user_id` | Your Moodle user ID |
| `username` | Your METU username |
| `password` | Your METU password (for auto re-login) |
| `year` | Selected academic year |
| `semester` | Selected semester code |

**`student-session.json`** - Student Portal session

| Field | Purpose |
|-------|---------|
| `token` | JWT from student.metu.edu.tr SSO |
| `username` | Your METU username |
| `password` | Your METU password (for token refresh) |

### How it is protected

- **File permissions `0600`** - only your OS user can read/write. No other user or process on the machine can access it.
- **Local only** - credentials never leave your machine. They are sent only to `*.metu.edu.tr` over HTTPS.
- **No telemetry** - zero analytics, zero tracking, zero external calls.
- **`odtu logout` wipes everything** - deletes all session files entirely.

### Why the password is stored

Both Moodle sessions and Student Portal JWTs expire. Without the saved password, you'd have to run `odtu login` every time. With it, the CLI silently re-authenticates in the background.

To disable: edit `~/.odtuclass/session.json` and remove the `password` field.

## How It Works

### ODTUClass (Moodle)

Authenticates against `odtuclass{year}{semester}.metu.edu.tr`:

1. **GET** `/login/index.php` - fetch login page, extract CSRF `logintoken`
2. **POST** `/login/index.php` - submit credentials
3. **GET** `/my/` - extract `sesskey` and `userId` from `M.cfg` JS object

Data is fetched via **Moodle AJAX API** (`/lib/ajax/service.php`) and **HTML scraping**.

| Moodle API Method | Used For |
|-------------------|----------|
| `core_webservice_get_site_info` | Auth check, user info |
| `core_course_get_enrolled_courses_by_timeline_classification` | Course listing |
| `core_course_get_contents` | Course sections/modules |
| `core_calendar_get_action_events_by_timesort` | Calendar events |
| `core_calendar_get_action_events_by_course` | Course-specific events |
| `mod_forum_get_forums_by_courses` | Forum listing |
| `mod_forum_get_forum_discussions` | Forum discussions |

### Student Portal (student.metu.edu.tr)

Authenticates via METU SSO with JWT tokens:

1. **POST** `/sso/backend/request/user/signin` - submit `{username, password}`, receive JWT in `Token` header
2. **POST** `/portal/backend/request/route/get_menu` - profile data + available services (uses `Token` header)
3. **POST** `/portal/backend/request/route/get_content` - get encrypted package token for a service
4. **GET** `/portal/content.php?pkg=<token>` - get auto-login form for Student Information proxy
5. **POST** `/proxy/Student_Information/main.php` - submit encrypted credentials (302 redirect)
6. **GET** `/proxy/Student_Information/get.php?package=<token>` - full Student Information HTML page (~185KB)

The HTML page contains 12 tabs of data parsed with cheerio:

| Tab | Data Available |
|-----|---------------|
| Contact | Ankara address, home address, Mernis address |
| Semester Detail | Enrolled courses, registration, add/drop, tuition, library debt, advisor |
| Academic Record | Per-semester GPA, courses with grades and grade points |
| Course Schedule | Weekly timetable grid |
| Transcript | Full transcript with ECTS, department ranking, notes |
| Curriculum | All required courses with completion status |
| Graduation | Graduation status |
| Exam Dates | Upcoming exam schedule |
| Scholarship | Scholarship information |
| Military | Military service info |
| Leave | Disciplinary/leave records |
| Replace Course | Course replacement history |

## For AI Agents

If you're an AI agent (Claude, GPT, Copilot, etc.) helping a user with this CLI:

### Setup

```bash
npm install -g odtu    # install globally
odtu login             # must run interactively (needs arrow keys + password input)
```

### ODTUClass data (per-semester Moodle data)

```bash
odtu courses                    # list courses with IDs
odtu grades                     # grades overview
odtu grades 1234                # detailed grades for course 1234
odtu assignments                # all assignments
odtu deadlines -d 7             # what's due in the next 7 days
odtu announcements 1234 -n 20   # latest 20 announcements for a course
odtu contents 1234              # course sections & materials
```

### Student Portal data (university-wide academic record)

```bash
odtu transcript    # full transcript: all semesters, all courses, all grades
odtu gpa           # GPA per semester + cumulative GPA + standing
odtu curriculum    # required courses with completion status
odtu schedule      # weekly course schedule
odtu profile       # student info, registered courses, tuition debt
```

### Programmatic notes

- All commands exit `0` on success, `1` on error
- Error output goes to stderr with prefixes: `Auth error:`, `API error:`, `Error:`
- Session files are at `~/.odtuclass/` (JSON, readable)
- `odtu login` requires an interactive terminal (TTY) for arrow-key prompts
- If sessions expire and credentials are saved, API calls auto-retry after re-login
- Course IDs are integers, visible in `odtu courses` output

### Data pipeline example

An AI agent can extract structured academic data by running CLI commands and parsing the terminal output. The transcript, GPA, and curriculum commands output formatted tables that contain all semester data, grades, credits, and completion status.

```bash
# Example: check if student is at risk
odtu gpa           # look at cumulative GPA and standing
odtu curriculum    # check completion percentage
odtu deadlines     # any upcoming deadlines?
```

### Session recovery

```bash
odtu status        # check if sessions are valid
odtu logout && odtu login   # full re-login if broken
```

## License

MIT - built with <3 by [ibracob.dev](https://ibracob.dev)
