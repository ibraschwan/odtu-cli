# ODTU CLI Command Output Reference

Detailed output formats for every command. Parse these when extracting structured data.

---

## odtu courses

Table with columns: **ID** (integer), **Course Name** (string), **Category** (department), **Fav** (★ or empty).

```
┌──────┬──────────────────────────────────────┬────────────────────┬─────┐
│  ID  │ Course Name                          │ Category           │ Fav │
├──────┼──────────────────────────────────────┼────────────────────┼─────┤
│ 1234 │ EE 201 Circuit Theory I              │ Electrical & Elec. │     │
│ 5678 │ CENG 242 Programming Languages       │ Computer Eng.      │  ★  │
└──────┴──────────────────────────────────────┴────────────────────┴─────┘
```

The **ID** column value is used as `<courseId>` in other commands.

---

## odtu grades (overview)

Table with columns: **ID** (course ID), **Course** (name), **Grade** (letter grade like AA, BB, etc.).

```
┌──────┬──────────────────────────────────────┬───────┐
│  ID  │ Course                               │ Grade │
├──────┼──────────────────────────────────────┼───────┤
│ 1234 │ EE 201 Circuit Theory I              │  BB   │
│ 5678 │ CENG 242 Programming Languages       │  AA   │
└──────┴──────────────────────────────────────┴───────┘
```

To get more detail for a specific course, use the course ID: `odtu grades 1234`

---

## odtu grades \<courseId\> (detailed)

Table with columns: **Item** (grade item name), **Grade** (numeric or letter), **Range** (max score),
**Percentage** (%), **Weight** (contribution to final), **Feedback** (instructor comment).

```
┌─────────────────────┬───────┬───────┬────────────┬────────┬──────────┐
│ Item                │ Grade │ Range │ Percentage │ Weight │ Feedback │
├─────────────────────┼───────┼───────┼────────────┼────────┼──────────┤
│ Midterm 1           │ 72    │ 100   │ 72.00%     │ 25%    │          │
│ Homework Average    │ 85    │ 100   │ 85.00%     │ 15%    │          │
│ Final Exam          │ 68    │ 100   │ 68.00%     │ 40%    │          │
│ Course total        │ BB    │  -    │ 73.40%     │   -    │          │
└─────────────────────┴───────┴───────┴────────────┴────────┴──────────┘
```

---

## odtu assignments [courseId]

Table with columns: **Course** (name), **Assignment** (title), **Type** (assign/quiz/turnitintooltwo), **Due** (date).

```
┌──────────────────────┬─────────────────────┬──────────┬──────────────────┐
│ Course               │ Assignment          │ Type     │ Due              │
├──────────────────────┼─────────────────────┼──────────┼──────────────────┤
│ EE 201               │ Homework 3          │ assign   │ 2026-03-01 23:59 │
│ CENG 242             │ Lab Report 2        │ assign   │ 2026-03-03 17:00 │
└──────────────────────┴─────────────────────┴──────────┴──────────────────┘
```

---

## odtu deadlines [courseId]

Table with columns: **Date** (YYYY-MM-DD HH:MM), **Event** (name), **Course** (name), **Type** (event type).

Only shows events within the time window (default 14 days, configurable with `-d`).

---

## odtu announcements [courseId]

Boxed cards, each containing: **Course** (header), **Author** (name), **Date**, **Preview** (first 300 chars of body).

---

## odtu contents \<courseId\>

ASCII tree showing course sections and their modules:

```
Section: Week 1 - Introduction
  📄 Lecture Notes 1.pdf
  📝 Homework 1
  🔗 Reference Link
Section: Week 2 - Basics
  📄 Lecture Notes 2.pdf
  📝 Quiz 1
```

Module icons: 📝 assign, ❓ quiz, 💬 forum, 📄 resource, 🔗 url, 📂 folder, 📋 page

---

## odtu forums \<courseId\>

Without `-f`: Table with columns: **ID** (forum ID), **Name** (forum title), **Type** (general/news/etc.), **Count** (discussion count).

With `-f <forumId>`: Boxed discussions with author, date, and message preview.

---

## odtu dashboard

Combined view:
1. Animated ASCII banner
2. Semester status (year, semester, domain)
3. Active courses table
4. Upcoming events (next 7 days) table

---

## odtu transcript

1. **Profile box**: Name, Student Number, Faculty, Department, Entry Date
2. **Per-semester tables** with columns: **Code** (course code), **Course Name**, **Credit**, **Grade** (letter), **ECTS**
3. **Semester summary**: GPA, Cumulative GPA, Total Credits, Standing

Data structure returned by the parser:
```
{
  student: { name, studentNo, faculty, department, entryDate },
  semesters: [{
    name: "2024-2025 Fall",
    courses: [{ code, name, credit, grade, totalCredit, ectsCredit }],
    summary: { gpa, cumGpa, totalCredits, totalGradePoints, standing }
  }],
  notes: []
}
```

---

## odtu gpa

Table with columns: **Semester** (name), **GPA** (semester), **Cum.GPA** (cumulative), **Credits**, **Grade Points**, **Standing**.

Then: visual progress bar for cumulative GPA and total credits earned.

Standing values: SATISFACTORY (green), UNSATISFACTORY (yellow), PROBATION (red).

---

## odtu curriculum

Grouped by semester with courses showing:
- **Status icon**: ✓ (passed, green), ✗ (failed, red), ○ (not taken, dim)
- **Code**: Course code
- **Category**: Required/Elective/etc.
- **Grade**: Letter grade if taken

Footer: Completion percentage with progress bar.

---

## odtu schedule

5-column grid: **Time** (HH:MM), **Monday**, **Tuesday**, **Wednesday**, **Thursday**, **Friday**.

Cells contain course codes/names for that time slot, empty if no class.

```
┌───────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Time  │ Monday   │ Tuesday  │ Wednesday│ Thursday │ Friday   │
├───────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 09:00 │ EE 201   │          │ EE 201   │          │ EE 201   │
│ 10:00 │          │ CENG 242 │          │ CENG 242 │          │
│ 13:00 │ MATH 260 │          │ MATH 260 │          │          │
└───────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

---

## odtu profile

1. **Profile box**: Name, Student Number, Faculty, Department, Entry Date, GPA, Standing
2. **Registered courses table**: Code, Name, Credit, Section
3. **Financial status**: Tuition debt/paid, Library debt/books
4. **Available portal services** list

---

## Error Output Patterns

All errors go to stderr:

```
Auth error: Not logged in. Run: odtu login
Auth error: Session expired
API error: <Moodle error message>
Error: Could not get Student Information package
Error: Student Information redirect failed
Error: Not logged in to student portal. Run: odtu login
```

Exit code is always `1` on error, `0` on success.
