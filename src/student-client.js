/**
 * METU Student Portal API client (student.metu.edu.tr).
 * Provides access to transcript, GPA, curriculum, schedule, profile, etc.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SESSION_DIR = join(homedir(), '.odtuclass');
const STUDENT_SESSION_FILE = join(SESSION_DIR, 'student-session.json');
const BASE = 'https://student.metu.edu.tr';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)';

export class StudentClient {
  constructor() {
    this.token = null;
    this.username = null;
    this.password = null;
    this._proxyCookies = {};
  }

  // ── Session persistence ──────────────────────────────────────

  saveSession() {
    mkdirSync(SESSION_DIR, { recursive: true });
    writeFileSync(STUDENT_SESSION_FILE, JSON.stringify({
      token: this.token,
      username: this.username,
      password: this.password,
    }));
    chmodSync(STUDENT_SESSION_FILE, 0o600);
  }

  loadSession() {
    if (!existsSync(STUDENT_SESSION_FILE)) return false;
    try {
      const data = JSON.parse(readFileSync(STUDENT_SESSION_FILE, 'utf-8'));
      this.token = data.token;
      this.username = data.username;
      this.password = data.password;
      return !!(this.token && this.username && this.password);
    } catch {
      return false;
    }
  }

  // ── Authentication ───────────────────────────────────────────

  async login(username, pwd) {
    const resp = await axios.post(`${BASE}/sso/backend/request/user/signin`,
      { username, password: pwd },
      {
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'User-Agent': UA,
          'Origin': BASE,
          'Referer': `${BASE}/sso/`,
        },
        validateStatus: () => true,
      },
    );
    const token = resp.headers['token'];
    const valid = resp.headers['token-valid'];
    if (!token || valid !== '1') {
      throw new Error('Student portal login failed. Check your credentials.');
    }
    this.token = token;
    this.username = username;
    this.password = pwd;
    this.saveSession();
  }

  async _ensureToken() {
    if (this.token) {
      // Check if token still works by hitting get_menu
      try {
        await this._portalPost('/portal/backend/request/route/get_menu');
        return;
      } catch { /* token expired, re-login */ }
    }
    if (!this.username || !this.password) {
      throw new Error('Not logged in to student portal. Run: odtu login');
    }
    await this.login(this.username, this.password);
  }

  // ── Portal API helpers ───────────────────────────────────────

  async _portalPost(path, body = null) {
    const headers = {
      'Token': this.token,
      'Content-Type': 'application/json;charset=UTF-8',
      'User-Agent': UA,
      'Origin': BASE,
      'Referer': `${BASE}/portal/`,
    };
    const resp = await axios.post(`${BASE}${path}`, body, { headers, validateStatus: () => true });
    if (resp.status !== 200) throw new Error(`Portal API error: ${resp.status}`);
    return resp.data;
  }

  // ── Public API ───────────────────────────────────────────────

  /** Profile + menu from portal */
  async getProfile() {
    await this._ensureToken();
    return await this._portalPost('/portal/backend/request/route/get_menu');
  }

  /** Fetch the full Student Information HTML page (app 61) */
  async _getStudentInfoHtml() {
    await this._ensureToken();

    // Step 1: Get pkg token
    const content = await this._portalPost('/portal/backend/request/route/get_content', {
      app: '61', additionalInfo: false,
    });
    if (!content || !content.pkg) throw new Error('Could not get Student Information package');

    // Step 2: Fetch auto-login form
    const pkgResp = await axios.get(`${BASE}/portal/content.php?pkg=${content.pkg}`, {
      headers: { 'User-Agent': UA },
      maxRedirects: 0,
    });
    const $ = cheerio.load(pkgResp.data);
    const action = $('form#autologin').attr('action');
    const formData = {};
    $('form#autologin input[type="hidden"]').each((_, el) => {
      formData[$(el).attr('name')] = $(el).attr('value');
    });
    if (!action) throw new Error('Could not find auto-login form');

    // Step 3: Submit form → get redirect to get.php
    const params = new URLSearchParams(formData);
    const loginResp = await axios.post(action, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      maxRedirects: 0,
      validateStatus: () => true,
    });

    // Collect cookies from response
    this._proxyCookies = {};
    for (const c of (loginResp.headers['set-cookie'] || [])) {
      const [nv] = c.split(';');
      const eq = nv.indexOf('=');
      if (eq > 0) this._proxyCookies[nv.slice(0, eq)] = nv.slice(eq + 1);
    }

    if (!loginResp.headers['location']) {
      throw new Error('Student Information redirect failed');
    }

    // Step 4: Follow redirect
    const location = new URL(loginResp.headers['location'], action).href;
    const cookieStr = Object.entries(this._proxyCookies).map(([k, v]) => `${k}=${v}`).join('; ');
    const getResp = await axios.get(location, {
      headers: { 'User-Agent': UA, 'Cookie': cookieStr },
      maxRedirects: 0,
    });

    return getResp.data;
  }

  // ── High-level parsed data ───────────────────────────────────

  async getTranscript() {
    const html = await this._getStudentInfoHtml();
    const $ = cheerio.load(html);
    return parseTranscript($);
  }

  async getAcademicRecord() {
    const html = await this._getStudentInfoHtml();
    const $ = cheerio.load(html);
    return parseAcademicRecord($);
  }

  async getCurriculum() {
    const html = await this._getStudentInfoHtml();
    const $ = cheerio.load(html);
    return parseCurriculum($);
  }

  async getCourseSchedule() {
    const html = await this._getStudentInfoHtml();
    const $ = cheerio.load(html);
    return parseCourseSchedule($);
  }

  async getSemesterDetail() {
    const html = await this._getStudentInfoHtml();
    const $ = cheerio.load(html);
    return parseSemesterDetail($);
  }

  async getFinancial() {
    const html = await this._getStudentInfoHtml();
    const $ = cheerio.load(html);
    return parseFinancial($);
  }

  async getAllStudentInfo() {
    const html = await this._getStudentInfoHtml();
    const $ = cheerio.load(html);
    return {
      transcript: parseTranscript($),
      academic: parseAcademicRecord($),
      curriculum: parseCurriculum($),
      schedule: parseCourseSchedule($),
      semester: parseSemesterDetail($),
      financial: parseFinancial($),
    };
  }
}

// ── Parsers ──────────────────────────────────────────────────────

function parseTranscript($) {
  const tab = $('#studentTranscript');
  const result = { student: {}, semesters: [], notes: [] };

  // Student metadata - search in all divs within the transcript panel
  const fullTabText = tab.text();
  for (const [key, field] of [
    ['Family Name', 'familyName'],
    ['Given Name', 'givenName'],
    ['Student No', 'studentNo'],
    ['Faculty', 'faculty'],
    ['Department / Program', 'department'],
    ['Date of Entry', 'dateOfEntry'],
    ['REASON OF LEAVING', 'reasonOfLeaving'],
    ['DATE OF LEAVING', 'dateOfLeaving'],
  ]) {
    const regex = new RegExp(key + '\\s+([^\\n]+?)(?=\\s{2,}|Family Name|Given Name|Student No|Faculty|Department|Date of|REASON|DATE OF|$)');
    const m = fullTabText.match(regex);
    if (m) result.student[field] = m[1].trim();
  }

  // Course table
  const table = tab.find('table').first();
  let currentSemester = null;

  table.find('tr').each((_, row) => {
    const cells = [];
    $(row).find('td, th').each((_, cell) => cells.push($(cell).text().trim()));

    // Skip header row
    if (cells[0] === 'Course Code') return;

    // Semester header row (single merged cell)
    if (cells.length <= 2 && cells[0] && cells[0].match(/^\d{4}-\d{4}/)) {
      currentSemester = { name: cells[0], courses: [], summary: {} };
      result.semesters.push(currentSemester);
      return;
    }

    // Summary row (CumGPA line)
    if (cells[0] && cells[0].startsWith('CumGPA:')) {
      if (currentSemester) {
        const text = cells.join(' ');
        const cumGpa = text.match(/CumGPA:\s*([\d,.]+)/);
        const gpa = text.match(/GPA:\s*([\d,.]+)/);
        const totCr = text.match(/TOT\.CR:\s*([\d,.]+)/);
        const totGr = text.match(/TOT\.GR:\s*([\d,.]+)/);
        const stan = text.match(/STAN:\s*(\w+(?:\s+\w+)?)/);
        currentSemester.summary = {
          cumGpa: cumGpa ? cumGpa[1].replace(',', '.') : null,
          gpa: gpa ? gpa[1].replace(',', '.') : null,
          totalCredits: totCr ? totCr[1].replace(',', '.') : null,
          totalGradePoints: totGr ? totGr[1].replace(',', '.') : null,
          standing: stan ? stan[1] : null,
        };
      }
      return;
    }

    // SEM.NO row
    if (cells[0] && cells[0].startsWith('SEM.NO:')) return;

    // Course row
    if (currentSemester && cells.length >= 4 && cells[0]) {
      const grade = cells[3] ? cells[3].replace(/\s+/g, ' ').split(/\s/)[0] : '';
      currentSemester.courses.push({
        code: cells[0],
        name: cells[1] || '',
        credit: cells[2] ? cells[2].replace(',', '.').replace(/\s*\*\s*$/, '') : '',
        grade: grade.replace(/\s*\*\s*$/, ''),
        totalCredit: cells[4] ? cells[4].replace(',', '.').replace(/[*\s]/g, '') : '',
        ectsCredit: cells[5] ? cells[5].replace(/[*\s(NTE)]/g, '').trim() : '',
      });
    }
  });

  // Notes at the bottom
  const fullText = table.parent().text();
  const notePatterns = [
    /She\/He attended.*?$/m,
    /The above mentioned.*?$/m,
  ];
  for (const pat of notePatterns) {
    const m = fullText.match(pat);
    if (m) result.notes.push(m[0].trim());
  }

  return result;
}

function parseAcademicRecord($) {
  const tab = $('#academicRecordSheet');
  const semesters = [];

  tab.find('.panel').each((_, panel) => {
    const heading = $(panel).find('.panel-heading').text().trim().replace(/\s+/g, ' ');
    const semMatch = heading.match(/Semester:\s*(.+)/);
    if (!semMatch) return;

    const semester = { name: semMatch[1], courses: [], summary: {} };
    const rows = [];

    $(panel).find('table tr').each((_, row) => {
      const cells = [];
      $(row).find('td, th').each((_, cell) => cells.push($(cell).text().trim()));
      if (cells.some(c => c)) rows.push(cells);
    });

    for (const cells of rows) {
      if (cells[0] === 'Courses') continue; // header
      if (cells[0] && cells[0].startsWith('GPA:')) {
        semester.summary.gpa = cells[0].replace('GPA:', '').trim();
        semester.summary.totalCredits = cells[2] || '';
        semester.summary.totalGradePoints = cells[3] || '';
        continue;
      }
      if (cells[0] && cells[0].startsWith('Cum.GPA:')) {
        semester.summary.cumGpa = cells[0].replace('Cum.GPA:', '').trim();
        continue;
      }
      if (cells[0] && cells[0].startsWith('Standing:')) {
        semester.summary.standing = cells[0].replace('Standing:', '').trim();
        continue;
      }
      if (cells[0] && cells.length >= 4) {
        semester.courses.push({
          name: cells[0],
          grade: cells[1],
          credit: cells[2],
          gradePoints: cells[3],
        });
      }
    }

    semesters.push(semester);
  });

  return semesters;
}

function parseCurriculum($) {
  const tab = $('#curriculum');
  const semesters = [];
  let currentSemester = null;

  // Semester headers are in .box-table-head-curriculum, courses in .box-row-curriculum
  // They're siblings inside .box-table-curriculum blocks
  tab.find('.box-table-curriculum').each((_, block) => {
    // Each block is one semester
    const headLabel = $(block).find('.box-table-head-curriculum .box-column-label-curriculum').text().trim();
    if (headLabel.match(/\d+\.SEMESTER/)) {
      currentSemester = { name: headLabel, courses: [] };
      semesters.push(currentSemester);
    }

    if (!currentSemester) return;

    $(block).find('.box-row-curriculum').each((_, row) => {
      const label = $(row).find('.box-column-label-curriculum').text().trim();
      const value = $(row).find('.box-column-value-curriculum').text().trim().replace(/\s+/g, ' ');

      if (!label) return;

      const course = { code: label };

      // Parse value like "PHYS 105 MUST COURSE CC" or "NONTECHNICAL ELECTIVE"
      if (value) {
        const parts = value.split(/\s+/);
        const lastPart = parts[parts.length - 1];
        const grades = ['AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'DD', 'FD', 'FF', 'NA', 'W', 'S', 'EX', 'U', 'P', 'I'];

        if (grades.includes(lastPart)) {
          course.grade = lastPart;
          // Category: skip the course code at the start, take everything between
          // Find where category starts (after the code repetition)
          const codeWords = label.split(/\s+/);
          const afterCode = parts.slice(codeWords.length, -1).join(' ');
          course.category = afterCode || null;
        } else {
          course.grade = null;
          const codeWords = label.split(/\s+/);
          const afterCode = parts.slice(codeWords.length).join(' ');
          course.category = afterCode || null;
        }
      } else {
        course.grade = null;
        course.category = null;
      }

      const passingGrades = ['AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'DD', 'S', 'EX', 'P'];
      course.completed = course.grade ? passingGrades.includes(course.grade) : false;

      currentSemester.courses.push(course);
    });
  });

  return semesters;
}

function parseCourseSchedule($) {
  const tab = $('#courseSchedule');
  const schedule = [];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  tab.find('table tr').each((_, row) => {
    const cells = [];
    $(row).find('td, th').each((_, cell) => {
      const text = $(cell).text().trim().replace(/\s+/g, ' ');
      const tooltip = $(cell).find('.tooltip, .class-info').text().trim();
      cells.push(text || tooltip || '');
    });

    // First cell is the time slot
    if (cells.length > 1 && cells[0].match(/^\d+:\d+$/)) {
      const time = cells[0];
      const daySlots = {};
      for (let i = 1; i < cells.length && i <= days.length; i++) {
        if (cells[i] && cells[i].length > 1) {
          daySlots[days[i - 1]] = cells[i];
        }
      }
      if (Object.keys(daySlots).length > 0) {
        schedule.push({ time, ...daySlots });
      }
    }
  });

  return schedule;
}

function parseSemesterDetail($) {
  const tab = $('#semesterDetail');
  const result = { enrolledCourses: [], registrationCourses: [], advisor: null };

  // First table: Registration Courses
  const tables = tab.find('table');

  if (tables.length > 0) {
    $(tables[0]).find('tr').each((_, row) => {
      const cells = [];
      $(row).find('td').each((_, cell) => cells.push($(cell).text().trim()));
      if (cells.length >= 7 && cells[0]) {
        result.registrationCourses.push({
          code: cells[0],
          name: cells[1],
          credit: cells[2],
          replaceCode: cells[3],
          replaceName: cells[4],
          replacedSemester: cells[5],
          category: cells[6],
          section: cells[7] || '',
        });
      }
    });
  }

  // Advisor panel
  const advisorText = tab.text();
  const advisorMatch = advisorText.match(/Advisor\s+([\w\s.]+)/);
  if (advisorMatch) {
    result.advisor = advisorMatch[1].trim();
  }

  return result;
}

function parseFinancial($) {
  const result = { tuition: { debt: '0.00', payment: '0.00' }, library: { books: '', debt: '' } };

  // Find tuition table
  $('table').each((_, table) => {
    const text = $(table).text();
    if (text.includes('Total Debt') && text.includes('Total Payment')) {
      const rows = [];
      $(table).find('tr').each((_, row) => {
        const cells = [];
        $(row).find('td').each((_, cell) => cells.push($(cell).text().trim()));
        if (cells.length >= 2) rows.push(cells);
      });
      if (rows.length > 0) {
        result.tuition.debt = rows[0][0] || '0.00';
        result.tuition.payment = rows[0][1] || '0.00';
      }
    }
    if (text.includes('Book Amount') && text.includes('Debt')) {
      const rows = [];
      $(table).find('tr').each((_, row) => {
        const cells = [];
        $(row).find('td').each((_, cell) => cells.push($(cell).text().trim()));
        if (cells.length >= 2) rows.push(cells);
      });
      if (rows.length > 0) {
        result.library.books = rows[0][0] || '0';
        result.library.debt = rows[0][1] || '0 TL';
      }
    }
  });

  return result;
}

export function getStudentClient() {
  const client = new StudentClient();
  if (!client.loadSession()) {
    throw new Error('Not logged in to student portal. Run: odtu login');
  }
  return client;
}
