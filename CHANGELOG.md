# Changelog

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
