# ODTU CLI Command Output Reference

All commands support the global `--json` flag (`odtu <cmd> --json`).
On error in `--json` mode, exit code is `1` and stderr receives:

```json
{
  "ok": false,
  "error": "Session expired or invalid",
  "type": "AuthError"
}
```

---

## `odtu status --json`

```json
{
  "loggedIn": true,
  "username": "e123456",
  "fullname": "ALI YILMAZ",
  "userId": 12345,
  "year": "2026",
  "semester": "f",
  "semesterDisplay": "2026-2027 Fall",
  "baseUrl": "https://odtuclass2026f.metu.edu.tr",
  "reauthenticated": false
}
```

When unauthenticated: `{ "loggedIn": false, "reason": "no_session" }` or `{ "loggedIn": false, "username": "...", "reason": "session_expired" }` (exit `1`).

---

## `odtu courses --json`

```json
{
  "semester": "2026-2027 Fall",
  "baseUrl": "https://odtuclass2026f.metu.edu.tr",
  "courses": [
    {
      "id": 1234,
      "fullname": "CENG 242 Programming Languages",
      "shortname": "CENG 242",
      "category": "Computer Engineering",
      "favourite": false
    }
  ]
}
```

Use `id` as `<courseId>` in subsequent commands.

---

## `odtu grades [courseId] --json`

Overview (`courseId` omitted):

```json
{
  "semester": "2026-2027 Fall",
  "grades": [
    { "courseid": 1234, "coursename": "CENG 242 Programming Languages", "grade": "85.00" }
  ]
}
```

Detailed (`courseId` provided):

```json
{
  "courseId": 1234,
  "items": [
    {
      "itemname": "Midterm 1",
      "weight": "30.00 %",
      "grade": "78.00",
      "col3": "71.40 (60)",
      "feedback": ""
    }
  ]
}
```

---

## `odtu assignments [courseId] --json`

```json
{
  "assignments": [
    {
      "courseid": 1234,
      "cmid": 5678,
      "name": "Homework 3",
      "modname": "assign",
      "week": "Week 6",
      "duedate": 1794517140,
      "dueDateText": "Thursday, November 12, 2026, 11:59 PM",
      "submissionStatus": "No submission",
      "grade": "-",
      "opendate": 0,
      "url": "https://odtuclass2026f.metu.edu.tr/mod/assign/view.php?id=5678",
      "courseName": "CENG 242 Programming Languages"
    }
  ]
}
```

Use `cmid` with `odtu assignment <cmid> --json`.

---

## `odtu assignment <cmid> --json`

```json
{
  "cmid": 5678,
  "url": "https://odtuclass2026f.metu.edu.tr/mod/assign/view.php?id=5678",
  "courseTitle": "CENG 242 Programming Languages",
  "title": "Homework 3",
  "opened": "Friday, October 23, 2026, 12:00 AM",
  "due": "Thursday, November 12, 2026, 11:59 PM",
  "dueTimestamp": 1794517140,
  "description": "Full assignment instructions...",
  "attachments": [
    { "name": "Prompt.pdf", "url": "https://.../pluginfile.php/..." }
  ],
  "submission": {
    "attempt": "This is attempt 1.",
    "status": "No submissions have been made yet",
    "gradingStatus": "Not graded",
    "timeRemaining": "2 hours 18 mins",
    "lastModified": "-",
    "files": []
  }
}
```

---

## `odtu deadlines [courseId] --json`

```json
{
  "days": 14,
  "events": [
    {
      "id": 9001,
      "name": "Homework 3 is due",
      "timesort": 1794517140,
      "date": "2026-11-12 23:59",
      "courseId": 1234,
      "courseName": "CENG 242 Programming Languages",
      "eventtype": "due",
      "modulename": "assign"
    }
  ]
}
```

---

## `odtu announcements [courseId] --json`

```json
{
  "announcements": [
    {
      "courseId": 1234,
      "courseName": "EE 201 Circuit Theory I",
      "id": 4321,
      "subject": "First Midterm Exam Places",
      "author": "Course Coordinator",
      "date": "2026-11-12 16:50",
      "message": "Plain text body..."
    }
  ]
}
```

---

## `odtu contents <courseId> --json`

```json
{
  "courseId": 1234,
  "sections": [
    {
      "id": 101,
      "name": "Week 1",
      "summary": "",
      "modules": [
        {
          "id": 5678,
          "name": "Homework 1",
          "modname": "assign",
          "url": "https://odtuclass2026f.metu.edu.tr/mod/assign/view.php?id=5678",
          "contents": []
        }
      ]
    }
  ]
}
```

`modname` values include `assign`, `quiz`, `forum`, `resource`, `url`, `page`, `folder`, `attendance`, `label`, `book`, `turnitintooltwo`.

---

## `odtu page <cmid> --json`

```json
{
  "cmid": 2345,
  "url": "https://odtuclass2026f.metu.edu.tr/mod/page/view.php?id=2345",
  "courseTitle": "EE 201 Circuit Theory I",
  "title": "Course Syllabus / Exam Guidelines",
  "text": "Extracted readable text...",
  "links": [{ "text": "Reference", "url": "https://..." }],
  "files": [{ "text": "Syllabus.pdf", "url": "https://.../pluginfile.php/..." }]
}
```

---

## `odtu attendance [courseId] --json`

```json
{
  "attendance": [
    {
      "courseId": 1234,
      "courseName": "EE 201 Circuit Theory I",
      "cmid": 3456,
      "url": "https://odtuclass2026f.metu.edu.tr/mod/attendance/view.php?id=3456",
      "sessions": [
        {
          "date": "Mon 12 Oct 2026 1.40PM",
          "description": "Week 3",
          "status": "Present",
          "points": "2 / 2",
          "remarks": ""
        }
      ],
      "summary": { "Attendance percentage": "100%" }
    }
  ]
}
```

---

## `odtu forums <courseId> --json`

- List forums (`odtu forums <courseId> --json`): `{ "courseId": 1234, "forums": [...] }`
- List discussions (`-f <forumId>`): `{ "forumId": 4001, "discussions": [...] }`
- Read posts (`-d <discussionId>`): `{ "discussionId": 4100, "subject": "...", "posts": [...] }`

---

## `odtu download` & `odtu materials`

- `odtu download <courseId> [moduleId] -o <dir> --json`:
  `{ "courseId": 1234, "moduleId": null, "output": "/abs/path", "downloaded": [...] }`
- `odtu materials <courseId> -o <dir> --json`:
  `{ "courseId": 1234, "courseRoot": "/abs/path", "filesSaved": 12, "linkCount": 3, "announcementCount": 5, "merged": ..., "manifest": [...] }`

---

## `odtu fetch <urlOrPath> --json`

HTML/text response:

```json
{
  "url": "https://odtuclass2026f.metu.edu.tr/mod/forum/discuss.php?d=4100",
  "contentType": "text/html; charset=utf-8",
  "title": "First Midterm Exam Places",
  "text": "...",
  "links": [{ "text": "...", "url": "https://..." }],
  "files": [{ "text": "exam_places.pdf", "url": "https://.../pluginfile.php/..." }]
}
```

With `-o <file>`: `{ "ok": true, "url": "...", "contentType": "...", "savedTo": "/abs/file", "bytes": 128085 }`.

---

## Student Portal (`student.metu.edu.tr` / SAIS)

- `odtu transcript --json`: `{ "student": { ... }, "semesters": [{ "name": "...", "courses": [...], "summary": { "gpa", "cumGpa", "totalCredits", "totalGradePoints", "standing" } }], "notes": [...] }`
- `odtu gpa --json`: `{ "semesters": [...], "current": { "gpa", "cumGpa", ... } }`
- `odtu curriculum --json`: `{ "semesters": [...] }`
- `odtu schedule --json`: `{ "schedule": [...] }`
- `odtu profile --json`: `{ "profile": { ... }, "transcript": { ... }, "semester": { ... }, "financial": { ... } }`
