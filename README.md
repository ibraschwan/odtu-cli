# odtu-cli

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
npm install -g odtu-cli
```

## Usage

```bash
odtu                    # show banner + help
odtu login              # interactive login wizard
odtu courses            # list enrolled courses
odtu grades             # grades overview
odtu grades <id>        # detailed grades for a course
odtu assignments        # all assignments
odtu deadlines          # upcoming events (next 14 days)
odtu announcements      # announcements across all courses
odtu announcements <id> # announcements for one course
odtu contents <id>      # course sections & activities
odtu forums <id>        # forums in a course
odtu dashboard          # full overview
odtu switch             # change semester
odtu status             # check session
odtu logout             # clear session
```

## Features

- Arrow-key semester & year selection
- Dithering ASCII banner animation
- Auto re-login when session expires (credentials saved locally)
- Gradient-colored UI with spinners and boxed panels
- Supports Fall, Spring & Summer semesters
- Academic year display (e.g. 2025-2026)
- Grades via HTML scraping (Moodle doesn't expose them via API)
- Assignment fallback scraping when API fails

## How it works

Authenticates against METU's Moodle instance (`odtuclass{year}{semester}.metu.edu.tr`) using session-based auth. Calls the Moodle AJAX API for courses, calendar, forums, and scrapes HTML for grades and assignments.

Session is saved to `~/.odtuclass/session.json` with `0600` permissions.

## License

MIT
