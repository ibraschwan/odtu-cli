# odtu

Access your METU courses right from the terminal. Interactive, fun, arrow-key driven.

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
        :::     welcome to odtu cli v1.0         built with <3 by ibracob.dev
```

## Install

```bash
npm install -g odtu
```

## Quick Start

```bash
odtu login    # interactive wizard - pick year, semester, enter credentials
odtu courses  # see your courses
odtu grades   # check your grades
```

## All Commands

| Command | Description |
|---------|-------------|
| `odtu` | Show animated banner + help |
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
| `odtu switch` | Change to a different semester |
| `odtu status` | Check current session status |
| `odtu logout` | Clear saved session and credentials |

## Features

- Arrow-key year & semester selection (no typing numbers)
- Dithering ASCII banner animation on startup
- Auto re-login when session expires - you log in once, it just works
- Gradient-colored terminal UI with animated spinners
- Academic year display (2025-2026 format)
- Grades via HTML scraping (Moodle doesn't expose them via API)
- Assignment fallback scraping when the API fails

## Security & Data Storage

Your data is stored locally on your machine. Nothing is sent anywhere except to METU's own servers.

### What is saved

A single file: `~/.odtuclass/session.json`

| Field | Purpose |
|-------|---------|
| `cookies` | Moodle session cookie (authenticates API requests) |
| `sesskey` | Moodle CSRF token (required for every API call) |
| `user_id` | Your Moodle user ID |
| `username` | Your METU username |
| `password` | Your METU password (for auto re-login) |
| `year` | Selected academic year |
| `semester` | Selected semester code |

### How it is protected

- **File permissions `0600`** - only your OS user can read/write the file. No other user or process on the machine can access it.
- **Local only** - credentials never leave your machine. They are sent only to `odtuclass*.metu.edu.tr` over HTTPS during login.
- **No telemetry** - zero analytics, zero tracking, zero external calls.
- **`odtu logout` wipes everything** - deletes the session file entirely.

### Why the password is stored

Moodle sessions expire after a period of inactivity. Without the saved password, you'd have to run `odtu login` every time the session expires. With it, the CLI silently re-authenticates in the background and you never notice.

If you prefer not to save your password, you can edit `~/.odtuclass/session.json` and remove the `password` field. Auto re-login will be disabled, but everything else works normally.

## How It Works

Authenticates against METU's Moodle instance (`odtuclass{year}{semester}.metu.edu.tr`) using session-based auth:

1. **GET** `/login/index.php` - fetch the login page, extract the CSRF `logintoken`
2. **POST** `/login/index.php` - submit username, password, logintoken
3. **GET** `/my/` - load dashboard, extract `sesskey` and `userId` from `M.cfg` JS object

After login, all data is fetched via:
- **Moodle AJAX API** (`/lib/ajax/service.php`) - courses, calendar events, forums, site info
- **HTML scraping** - grades overview, detailed course grades, assignment fallback

### Moodle API Methods Used

| Method | Used For |
|--------|----------|
| `core_webservice_get_site_info` | Auth check, user info |
| `core_course_get_enrolled_courses_by_timeline_classification` | Course listing |
| `core_course_get_contents` | Course sections/modules, assignments |
| `core_calendar_get_action_events_by_timesort` | Calendar events by date range |
| `core_calendar_get_action_events_by_course` | Calendar events by course |
| `mod_forum_get_forums_by_courses` | Forum listing |
| `mod_forum_get_forum_discussions` | Forum discussions |

### HTML Pages Scraped

| Page | Used For |
|------|----------|
| `/grade/report/overview/index.php` | Grades overview table |
| `/course/user.php?mode=grade&id=X&user=Y` | Detailed course grades |
| `/course/view.php?id=X` | Assignment fallback |

## For AI Agents

If you're an AI agent helping a user with this CLI, here's what you need to know:

### Setup
```bash
npm install -g odtu    # install globally
odtu login             # must run interactively (needs arrow keys + password input)
```

### Common patterns
```bash
# Get all course IDs
odtu courses

# Get grades for course 1234
odtu grades 1234

# Check what's due in the next 7 days
odtu deadlines -d 7

# Get announcements for a specific course
odtu announcements 1234 -n 20

# If session is broken, re-login
odtu logout && odtu login
```

### Programmatic notes
- All commands exit `0` on success, `1` on error
- Error output goes to stderr with prefixes: `Auth error:`, `API error:`, `Error:`
- Session file is at `~/.odtuclass/session.json` (JSON, readable)
- The `login` command requires an interactive terminal (TTY) for arrow-key prompts
- If the session expires and credentials are saved, API calls auto-retry after re-login
- Course IDs are integers, visible in `odtu courses` output

## License

MIT - built with <3 by [ibracob.dev](https://ibracob.dev)
