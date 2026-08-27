# Changelog

## 2.1.2 (2026-08-27)

- Fix `odtu materials` announcement bodies: read `.post-content-container` and the
  header byline, which recent Moodle themes use instead of `.posting`/`.author`.
  Announcements previously archived as title and source URL only.
- Record URL, H5P, LTI, and page activities in `links-index.md`, resolving each
  URL activity to its external target and extracting inline Zoom passcodes.

## 2.1.1 (2026-08-06)

- Add GitHub Actions CI across supported Node.js releases.
- Add tag-driven npm publishing through OIDC trusted publishing.
- Correct the minimum Node.js version to match runtime dependencies.

## 2.1.0 (2026-08-06)

- Add `odtu materials` to archive course files and announcements by week.
- Fall back to authenticated Moodle HTML when course AJAX services are disabled.
- Optionally convert PPT/PPTX files with LibreOffice and merge PDFs weekly or into one file.
- Ignore local `ders/` and `downloads/` directories to protect private course material.

## 2.0.1 (2026-08-06)

- Use the `sum` hostname suffix for ODTUClass summer semesters.
- Add authenticated downloads for course and assignment attachments.
- Show module IDs in assignment and course-content listings.

## 2.0.0 (2026-02-26)

### Student Portal Integration

Added full integration with METU's Student Information System (`student.metu.edu.tr`), bringing university-wide academic data into the CLI alongside the existing ODTUClass/Moodle features.

#### New commands

- **`odtu transcript`** - Full university transcript: every semester, every course, grades, ECTS credits, cumulative GPA
- **`odtu gpa`** - Semester-by-semester GPA history with visual progress bar and standing
- **`odtu curriculum`** - Curriculum completion tracker showing all required courses with pass/fail/not-taken status and progress percentage
- **`odtu schedule`** - Weekly course schedule grid
- **`odtu profile`** - Student profile (name, student number, faculty, department, entry date), registered courses, tuition/library debt, and available portal services

#### Changes

- `odtu login` now authenticates with both ODTUClass (Moodle) and the Student Portal in a single step
- Login success screen updated with new command suggestions
- New session file `~/.odtuclass/student-session.json` stores the student portal JWT (file permissions `0600`)

#### Technical details

- New `StudentClient` class handles the student portal's JWT-based SSO authentication
- Student Information data is fetched via a 4-step proxy authentication flow (SSO -> portal -> content.php -> Student_Information/get.php)
- HTML parsing with cheerio extracts structured data from 12 tab sections (transcript, academic record, curriculum, schedule, contact, military, scholarship, semester detail, graduation, leave, replace course, exam dates)

## 1.0.0 (2026-02-24)

Initial release. ODTUClass Moodle integration with:
- Interactive login wizard with arrow-key selection
- Course listing, grades, assignments, deadlines, forums, announcements
- Full dashboard overview
- Auto re-login on session expiry
- Animated ASCII banner with gradient colors
