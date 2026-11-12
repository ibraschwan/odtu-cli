/**
 * ODTUClass Moodle API client with session-based authentication.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync, chmodSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SESSION_DIR = join(homedir(), '.odtuclass');
const SESSION_FILE = join(SESSION_DIR, 'session.json');

export function makeBaseUrl(year, semester) {
  const semesterPrefix = semester.toLowerCase() === 'u' ? 'sum' : semester.toLowerCase();
  return `https://odtuclass${year}${semesterPrefix}.metu.edu.tr`;
}

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

export class APIError extends Error {
  constructor(message) {
    super(message);
    this.name = 'APIError';
  }
}

export class ODTUClassClient {
  constructor(year = null, semester = null) {
    this.cookies = {};
    this.sesskey = null;
    this.userId = null;
    this.username = null;
    this.password = null;
    this.year = year;
    this.semester = semester;
    this.baseUrl = (year && semester) ? makeBaseUrl(year, semester) : null;
  }

  // ── Cookie management ──────────────────────────────────────────

  _cookieStr() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  _collectCookies(resp) {
    const sc = resp.headers['set-cookie'];
    if (!sc) return;
    for (const c of (Array.isArray(sc) ? sc : [sc])) {
      const [nameValue] = c.split(';');
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx > 0) {
        this.cookies[nameValue.slice(0, eqIdx).trim()] = nameValue.slice(eqIdx + 1).trim();
      }
    }
  }

  async _request(method, url, data = null, { json = false, params = null, responseType = null } = {}) {
    const headers = {
      'User-Agent': 'ODTU-CLI/1.0',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
    };

    const cookieStr = this._cookieStr();
    if (cookieStr) headers.Cookie = cookieStr;
    if (json) headers['Content-Type'] = 'application/json';

    const config = {
      method,
      url,
      headers,
      maxRedirects: 0,
      validateStatus: () => true,
    };

    if (params) config.params = params;
    if (data !== null) config.data = data;
    if (responseType) config.responseType = responseType;

    let resp = await axios(config);
    this._collectCookies(resp);

    // Follow redirects manually to preserve cookies
    let redirectCount = 0;
    while (resp.status >= 300 && resp.status < 400 && resp.headers.location && redirectCount < 10) {
      const location = new URL(resp.headers.location, url).href;
      const redirectHeaders = {
        'User-Agent': 'ODTU-CLI/1.0',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
      };
      const cs = this._cookieStr();
      const baseOrigin = this.baseUrl ? new URL(this.baseUrl).origin : new URL(url).origin;
      if (cs && new URL(location).origin === baseOrigin) redirectHeaders.Cookie = cs;

      resp = await axios({
        method: 'GET',
        url: location,
        headers: redirectHeaders,
        maxRedirects: 0,
        validateStatus: () => true,
        ...(responseType ? { responseType } : {}),
      });
      this._collectCookies(resp);
      url = location;
      redirectCount++;
    }

    resp.finalUrl = resp.config.url;

    if (resp.status >= 400) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }

    return resp;
  }

  // ── Session persistence ────────────────────────────────────────

  saveSession() {
    mkdirSync(SESSION_DIR, { recursive: true });
    const data = {
      cookies: this.cookies,
      sesskey: this.sesskey,
      user_id: this.userId,
      username: this.username,
      password: this.password,
      year: this.year,
      semester: this.semester,
    };
    writeFileSync(SESSION_FILE, JSON.stringify(data));
    chmodSync(SESSION_FILE, 0o600);
  }

  loadSession() {
    if (!existsSync(SESSION_FILE)) return false;
    try {
      const data = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
      this.cookies = data.cookies || {};
      this.sesskey = data.sesskey;
      this.userId = data.user_id;
      this.username = data.username;
      this.password = data.password || null;
      this.year = data.year;
      this.semester = data.semester;
      if (this.year && this.semester) {
        this.baseUrl = makeBaseUrl(this.year, this.semester);
      }
      return !!(this.sesskey && this.baseUrl);
    } catch {
      return false;
    }
  }

  clearSession() {
    if (existsSync(SESSION_FILE)) unlinkSync(SESSION_FILE);
    this.cookies = {};
    this.sesskey = null;
    this.userId = null;
    this.username = null;
    this.password = null;
  }

  get semesterDisplay() {
    if (!this.year || !this.semester) return '?';
    const names = { f: 'Fall', s: 'Spring', u: 'Summer' };
    return `${this.year}-${this.year + 1} ${names[this.semester.toLowerCase()] || this.semester.toUpperCase()}`;
  }

  // ── Authentication ─────────────────────────────────────────────

  async login(username, password, onProgress = () => {}) {
    if (!this.baseUrl) throw new AuthError('No semester selected');

    // Step 1: GET login page for logintoken
    onProgress('Connecting to ODTUClass...');
    const loginPageResp = await this._request('GET', `${this.baseUrl}/login/index.php`);
    const $ = cheerio.load(loginPageResp.data);
    const logintoken = $('input[name="logintoken"]').val();
    if (!logintoken) throw new AuthError('Could not find logintoken on login page');

    // Step 2: POST credentials
    onProgress('Authenticating...');
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    params.append('logintoken', logintoken);

    const loginResp = await this._request('POST', `${this.baseUrl}/login/index.php`, params);

    // Check for login failure
    const finalUrl = loginResp.finalUrl || '';
    if (finalUrl.includes('/login/index.php') && !finalUrl.includes('testsession')) {
      const $err = cheerio.load(loginResp.data);
      const errEl = $err('a#loginerrormessage');
      throw new AuthError(errEl.text().trim() || 'Login failed');
    }

    // Step 3: GET dashboard to extract sesskey
    onProgress('Loading profile...');
    const dashResp = await this._request('GET', `${this.baseUrl}/my/`);
    this._extractSessionInfo(dashResp.data);
    this.username = username;
    this.password = password;
    this.saveSession();
  }

  _extractSessionInfo(html) {
    const match = html.match(/M\.cfg\s*=\s*(\{.*?\});/s);
    if (!match) throw new AuthError('Could not extract session config from dashboard');
    try {
      const cfg = JSON.parse(match[1]);
      this.sesskey = cfg.sesskey;
      this.userId = cfg.userId;
      if (!this.sesskey) throw new AuthError('No sesskey found in session config');
    } catch (e) {
      if (e instanceof AuthError) throw e;
      throw new AuthError('Could not parse session config JSON');
    }
  }

  async isAuthenticated() {
    if (!this.sesskey || !this.baseUrl) return false;
    try {
      const result = await this._apiCallRaw('core_webservice_get_site_info', {});
      if (result && 'userid' in result) return true;
    } catch {
      // Some ODTUClass instances disable core_webservice_get_site_info; verify via /my/
    }
    try {
      const resp = await this._request('GET', `${this.baseUrl}/my/`);
      if ((resp.finalUrl || '').includes('/login/index.php')) return false;
      this._extractSessionInfo(resp.data);
      return !!this.sesskey;
    } catch {
      return false;
    }
  }

  ensureAuth() {
    if (this.sesskey) return;
    if (!this.loadSession()) {
      throw new AuthError('Not logged in. Run: odtu login');
    }
  }

  // ── Auto re-login ─────────────────────────────────────────────

  _canAutoReLogin() {
    return !!(this.username && this.password && this.year && this.semester);
  }

  async _autoReLogin() {
    this.cookies = {};
    this.sesskey = null;
    this.userId = null;
    this.baseUrl = makeBaseUrl(this.year, this.semester);
    await this.login(this.username, this.password);
  }

  _isAuthRelatedError(e) {
    const msg = (e.message || '').toLowerCase();
    return msg.includes('sesskey') ||
           msg.includes('session') ||
           msg.includes('not logged in') ||
           msg.includes('access denied') ||
           msg.includes('access control') ||
           msg.includes('unexpected response');
  }

  // ── API calls ──────────────────────────────────────────────────

  async apiCall(methodname, args, _retried = false) {
    try {
      return await this._apiCallRaw(methodname, args);
    } catch (e) {
      if (!_retried && this._canAutoReLogin() && this._isAuthRelatedError(e)) {
        try {
          await this._autoReLogin();
          return await this._apiCallRaw(methodname, args);
        } catch { /* re-login failed, throw original */ }
      }
      throw e;
    }
  }

  async _apiCallRaw(methodname, args) {
    const resp = await this._request(
      'POST',
      `${this.baseUrl}/lib/ajax/service.php`,
      [{ index: 0, methodname, args }],
      { json: true, params: { sesskey: this.sesskey, info: methodname } },
    );

    const data = resp.data;

    if (typeof data === 'string') {
      throw new APIError('Unexpected response from server');
    }

    if (!Array.isArray(data) && data.error) {
      throw new APIError(data.message || 'Unknown API error');
    }

    const result = data[0];
    if (result.error) {
      const err = result.exception || {};
      throw new APIError(err.message || 'API call failed');
    }
    return result.data !== undefined ? result.data : result;
  }

  async apiBatch(calls, _retried = false) {
    if (!calls.length) return [];
    try {
      return await this._apiBatchRaw(calls);
    } catch (e) {
      if (!_retried && this._canAutoReLogin() && this._isAuthRelatedError(e)) {
        try {
          await this._autoReLogin();
          return await this._apiBatchRaw(calls);
        } catch { /* re-login failed, throw original */ }
      }
      throw e;
    }
  }

  async _apiBatchRaw(calls) {
    const methodNames = calls.map(c => c[0]).join(',');
    const body = calls.map(([name, args], i) => ({ index: i, methodname: name, args }));

    const resp = await this._request(
      'POST',
      `${this.baseUrl}/lib/ajax/service.php`,
      body,
      { json: true, params: { sesskey: this.sesskey, info: methodNames } },
    );

    if (typeof resp.data === 'string' || !Array.isArray(resp.data)) {
      throw new APIError('Unexpected response from server');
    }

    return resp.data.map(item => {
      if (item.error) {
        const err = item.exception || {};
        throw new APIError(err.message || 'API batch call failed');
      }
      return item.data !== undefined ? item.data : item;
    });
  }

  // ── Internal HTML parsing helpers ──────────────────────────────

  _clean(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  _extractCmid(elOrHref, $ = null) {
    if ($ && elOrHref) {
      const domId = $(elOrHref).attr('id') || '';
      const idMatch = domId.match(/^module-(\d+)$/);
      if (idMatch) return parseInt(idMatch[1], 10);
      const dataId = $(elOrHref).attr('data-id');
      if (dataId && /^\d+$/.test(dataId)) return parseInt(dataId, 10);
    }
    const href = typeof elOrHref === 'string'
      ? elOrHref
      : ($ && elOrHref ? ($(elOrHref).find('a[href]').first().attr('href') || '') : '');
    const m = href.match(/[?&]id=(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  _parseDateTs(text) {
    const cleaned = this._clean(text);
    if (!cleaned || cleaned === '-') return 0;
    const ms = Date.parse(cleaned);
    return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
  }

  _isLoginPage(resp) {
    const finalUrl = resp.finalUrl || '';
    if (finalUrl.includes('/login/index.php')) return true;
    return typeof resp.data === 'string' && resp.data.includes('name="logintoken"');
  }

  // ── High-level methods ─────────────────────────────────────────

  async getCourses(classification = 'all') {
    try {
      const data = await this.apiCall(
        'core_course_get_enrolled_courses_by_timeline_classification',
        {
          offset: 0,
          limit: 0,
          classification,
          sort: 'fullname',
          customfieldname: '',
          customfieldvalue: '',
        },
      );
      return data.courses || [];
    } catch (e) {
      if (!(e instanceof APIError)) throw e;
      return await this._scrapeCoursesHtml();
    }
  }

  async _scrapeCoursesHtml() {
    const html = await this.getPageHtml('/my/courses.php');
    const $ = cheerio.load(html);
    const seen = new Map();
    $('a[href*="/course/view.php?id="]').each((_, a) => {
      const href = $(a).attr('href') || '';
      const m = href.match(/[?&]id=(\d+)/);
      const name = this._clean($(a).text());
      if (m && name) {
        const id = parseInt(m[1], 10);
        if (!seen.has(id)) {
          seen.set(id, { id, fullname: name, shortname: name, coursecategory: '' });
        }
      }
    });
    return [...seen.values()];
  }

  async getCourseContents(courseId) {
    try {
      const sections = await this.apiCall('core_course_get_contents', { courseid: courseId });
      if (Array.isArray(sections)) return sections;
    } catch (e) {
      if (!(e instanceof APIError)) throw e;
    }
    return await this._scrapeCourseContentsHtml(courseId);
  }

  async _scrapeCourseContentsHtml(courseId) {
    const html = await this.getPageHtml(`/course/view.php?id=${courseId}`);
    const $ = cheerio.load(html);
    const sections = [];

    $('li.course-section, li.section.main').each((idx, sec) => {
      const $sec = $(sec);
      const secTitle = this._clean(
        $sec.find('[data-for="section_title"], h3.sectionname, .sectionname').first().text(),
      ) || `Section ${idx}`;
      const summary = this._clean($sec.find('.summary, .section_availability').first().text());
      const modules = [];

      $sec.find('li.activity').each((_, act) => {
        const $act = $(act);
        const classes = ($act.attr('class') || '').split(/\s+/);
        let modname = 'activity';
        for (const cls of classes) {
          if (cls.startsWith('modtype_')) {
            modname = cls.replace('modtype_', '');
            break;
          }
        }
        const anchor = $act.find('a.aalink, a[href*="/mod/"]').first();
        const url = anchor.attr('href') || '';
        const cmid = this._extractCmid($act, $) || this._extractCmid(url);
        let name = this._clean(anchor.find('.instancename').clone().children('.accesshide').remove().end().text());
        if (!name) name = this._clean(anchor.text());
        if (!name && modname === 'label') {
          name = this._clean($act.find('.contentwithoutlink, .activity-altcontent, .no-overflow').first().text());
        }
        const description = this._clean($act.find('.contentafterlink, .activity-altcontent').first().text());
        const datesText = this._clean($act.find('[data-region="activity-dates"]').text());

        if (name || url || description) {
          modules.push({
            id: cmid,
            name: name || modname,
            modname,
            url,
            description,
            datesText,
            contents: [],
          });
        }
      });

      sections.push({
        id: idx,
        name: secTitle,
        summary,
        modules,
        source: 'html',
      });
    });

    return sections;
  }

  async downloadFile(fileUrl, _retried = false) {
    const url = new URL(fileUrl, this.baseUrl);
    if (url.origin !== new URL(this.baseUrl).origin) {
      throw new APIError('Refusing to send session credentials to an external download host');
    }

    const resp = await this._request('GET', url.href, null, { responseType: 'arraybuffer' });
    const finalUrl = resp.finalUrl || '';
    if (!_retried && finalUrl.includes('/login/index.php') && this._canAutoReLogin()) {
      await this._autoReLogin();
      return await this.downloadFile(fileUrl, true);
    }
    if (finalUrl.includes('/login/index.php')) {
      throw new AuthError('Session expired. Run: odtu login');
    }
    return {
      buffer: Buffer.from(resp.data),
      finalUrl,
      contentType: resp.headers?.['content-type'] || '',
      contentDisposition: resp.headers?.['content-disposition'] || '',
    };
  }

  async resolveActivityFiles(mod) {
    if (Array.isArray(mod.contents) && mod.contents.length) {
      return mod.contents
        .filter(item => item.type === 'file' && item.fileurl)
        .map(item => ({ filename: item.filename || mod.name, fileurl: item.fileurl, moduleName: mod.name }));
    }
    if (!mod.url) return [];
    const parsed = new URL(mod.url, this.baseUrl);
    if (parsed.origin !== new URL(this.baseUrl).origin) return [];

    const resp = await this._request('GET', parsed.href, null, { responseType: 'arraybuffer' });
    if (this._isLoginPage(resp) && this._canAutoReLogin()) {
      await this._autoReLogin();
      return await this.resolveActivityFiles(mod);
    }
    const ct = (resp.headers?.['content-type'] || '').toLowerCase();
    if (!ct.includes('text/html')) {
      return [{ filename: mod.name, fileurl: resp.finalUrl || parsed.href, moduleName: mod.name }];
    }

    const $ = cheerio.load(Buffer.from(resp.data).toString('utf8'));
    const seen = new Set();
    const files = [];
    $('#region-main a[href*="/pluginfile.php/"]').each((_, a) => {
      const u = new URL($(a).attr('href'), this.baseUrl);
      if (u.origin === new URL(this.baseUrl).origin && !seen.has(u.href)) {
        seen.add(u.href);
        const label = this._clean($(a).text()) || decodeURIComponent(u.pathname.split('/').pop() || mod.name);
        files.push({ filename: label, fileurl: u.href, moduleName: mod.name });
      }
    });
    return files;
  }

  async getGradesOverview() {
    const html = await this.getPageHtml('/grade/report/overview/index.php');
    const $ = cheerio.load(html);
    const table = $('table#overview-grade');
    if (!table.length) return [];

    const grades = [];
    table.find('tbody tr').each((_, row) => {
      const $row = $(row);
      if ($row.hasClass('emptyrow')) return;
      const cells = $row.find('td');
      if (cells.length < 2) return;

      const link = cells.eq(0).find('a');
      const courseName = link.length ? link.text().trim() : cells.eq(0).text().trim();
      let courseId = null;
      if (link.length) {
        const href = link.attr('href') || '';
        const m = href.match(/id=(\d+)/);
        if (m) courseId = parseInt(m[1], 10);
      }
      const grade = cells.eq(1).text().trim();
      grades.push({
        coursename: courseName,
        courseid: courseId,
        grade: (grade && grade !== '-') ? grade : '-',
      });
    });
    return grades;
  }

  async getCourseGrades(courseId) {
    const html = await this.getPageHtml(
      `/course/user.php?mode=grade&id=${courseId}&user=${this.userId}`,
    );
    const $ = cheerio.load(html);
    let table = $('table.user-grade');
    if (!table.length) table = $('table.generaltable');
    if (!table.length) return [];

    const headers = [];
    const thead = table.find('thead');
    (thead.length ? thead : table).find('th').each((_, th) => {
      headers.push($(th).text().trim().toLowerCase());
    });

    const items = [];
    table.find('tbody tr').each((_, row) => {
      const cells = $(row).find('td, th');
      if (!cells.length) return;

      const item = {};
      item.itemname = this._clean(cells.eq(0).text());

      cells.slice(1).each((i, cell) => {
        const idx = i + 1;
        const text = this._clean($(cell).text());
        if (idx < headers.length) {
          const header = headers[idx];
          if (header.includes('grade')) item.grade = text;
          else if (header.includes('range')) item.range = text;
          else if (header.includes('percentage') || header.includes('%')) item.percentage = text;
          else if (header.includes('feedback')) item.feedback = text;
          else if (header.includes('weight')) item.weight = text;
          else if (header.includes('contribution')) item.contribution = text;
          else item[`col${idx}`] = text;
        } else {
          item[`col${idx}`] = text;
        }
      });

      if (item.itemname) items.push(item);
    });
    return items;
  }

  async getAssignments(courseIds) {
    const allAssignments = [];
    for (const cid of courseIds) {
      const byCmid = new Map();

      // 1. Rich table from /mod/assign/index.php?id=<cid> (includes due dates, submission status, grade)
      try {
        const idxHtml = await this.getPageHtml(`/mod/assign/index.php?id=${cid}`);
        const $ = cheerio.load(idxHtml);
        const headers = $('table.generaltable thead th').map((_, th) => this._clean($(th).text()).toLowerCase()).get();
        $('table.generaltable tbody tr').each((_, tr) => {
          const cells = $(tr).find('td');
          if (cells.length < 2) return;
          const link = $(tr).find('a[href*="/mod/assign/view.php"]').first();
          if (!link.length) return;
          const url = link.attr('href') || '';
          const cmid = this._extractCmid(url);
          const cellTexts = cells.map((__, td) => this._clean($(td).text())).get();
          const weekIdx = headers.findIndex(h => h.includes('week') || h.includes('section') || h.includes('topic'));
          const dueIdx = headers.findIndex(h => h.includes('due'));
          const subIdx = headers.findIndex(h => h.includes('submission'));
          const gradeIdx = headers.findIndex(h => h.includes('grade'));

          const dueDateText = dueIdx >= 0 ? (cellTexts[dueIdx] || '') : (cellTexts[2] || '');
          const item = {
            courseid: cid,
            cmid,
            name: this._clean(link.text()),
            modname: 'assign',
            week: weekIdx >= 0 ? (cellTexts[weekIdx] || '') : (cellTexts[0] || ''),
            duedate: this._parseDateTs(dueDateText),
            dueDateText,
            submissionStatus: subIdx >= 0 ? (cellTexts[subIdx] || '') : (cellTexts[3] || ''),
            grade: gradeIdx >= 0 ? (cellTexts[gradeIdx] || '-') : (cellTexts[4] || '-'),
            opendate: 0,
            url,
          };
          if (cmid) byCmid.set(cmid, item);
          else allAssignments.push(item);
        });
      } catch { /* fall through to contents */ }

      // 2. Merge with course contents for quiz / turnitintooltwo / any unindexed assign
      const sections = await this.getCourseContents(cid);
      for (const section of sections) {
        for (const mod of (section.modules || [])) {
          if (!['assign', 'turnitintooltwo', 'quiz'].includes(mod.modname)) continue;
          if (mod.id && byCmid.has(mod.id)) continue;

          const dates = {};
          for (const d of (mod.dates || [])) {
            const label = (d.label || '').toLowerCase();
            if (label.includes('due') || label.includes('close')) dates.duedate = d.timestamp || 0;
            else if (label.includes('open')) dates.opendate = d.timestamp || 0;
          }
          const item = {
            courseid: cid,
            cmid: mod.id || this._extractCmid(mod.url || ''),
            name: mod.name || '?',
            modname: mod.modname,
            week: section.name || '',
            duedate: dates.duedate || 0,
            dueDateText: mod.datesText || '',
            submissionStatus: '',
            grade: '-',
            opendate: dates.opendate || 0,
            url: mod.url || '',
          };
          if (item.cmid) byCmid.set(item.cmid, item);
          else allAssignments.push(item);
        }
      }

      allAssignments.push(...byCmid.values());
    }
    return allAssignments;
  }

  async getAssignmentDetail(cmid) {
    const html = await this.getPageHtml(`/mod/assign/view.php?id=${cmid}`);
    const $ = cheerio.load(html);
    const courseTitle = this._clean($('.page-header-headings h1, h1').first().text());
    const title = this._clean($('#region-main h2').first().text()) || courseTitle;
    const datesText = this._clean($('[data-region="activity-dates"]').text());
    const openedMatch = datesText.match(/Opened:\s*(.+?)(?=Due:|$)/i);
    const dueMatch = datesText.match(/Due:\s*(.+)$/i);

    const descriptionEl = $('#intro, .activity-description').first();
    const description = this._clean(descriptionEl.text());
    const attachments = [];
    const seenAttach = new Set();
    $('#intro a[href*="/pluginfile.php/"], .activity-description a[href*="/pluginfile.php/"]').each((_, a) => {
      const href = $(a).attr('href');
      if (href && !seenAttach.has(href)) {
        seenAttach.add(href);
        attachments.push({ name: this._clean($(a).text()) || 'attachment', url: href });
      }
    });

    const submission = {};
    const submittedFiles = [];
    $('table.generaltable tr').each((_, tr) => {
      const k = this._clean($(tr).find('th').first().text()).toLowerCase();
      const td = $(tr).find('td').first();
      if (!k || !td.length) return;
      const v = this._clean(td.text());
      if (k.includes('attempt')) submission.attempt = v;
      else if (k.includes('submission status')) submission.status = v;
      else if (k.includes('grading status')) submission.gradingStatus = v;
      else if (k.includes('time remaining')) submission.timeRemaining = v;
      else if (k.includes('last modified')) submission.lastModified = v;
      else if (k.includes('online text')) submission.onlineText = v;
      else if (k.includes('feedback comments')) submission.feedback = v;
      else if (k === 'grade') submission.grade = v;
      else if (k.includes('file submissions')) {
        td.find('a[href*="/pluginfile.php/"]').each((__, a) => {
          submittedFiles.push({ name: this._clean($(a).text()), url: $(a).attr('href') });
        });
        submission.filesSummary = v;
      }
    });
    if (submittedFiles.length) submission.files = submittedFiles;

    return {
      cmid,
      url: `${this.baseUrl}/mod/assign/view.php?id=${cmid}`,
      courseTitle,
      title,
      opened: openedMatch ? this._clean(openedMatch[1]) : '',
      due: dueMatch ? this._clean(dueMatch[1]) : '',
      dueTimestamp: dueMatch ? this._parseDateTs(dueMatch[1]) : 0,
      description,
      attachments,
      submission,
    };
  }

  async getPageContent(cmid) {
    const html = await this.getPageHtml(`/mod/page/view.php?id=${cmid}`);
    const $ = cheerio.load(html);
    const courseTitle = this._clean($('.page-header-headings h1, h1').first().text());
    const title = this._clean($('#region-main h2').first().text()) || courseTitle;
    const main = $('#region-main .generalbox, #region-main .box').first();
    const scope = main.length ? main : $('#region-main');

    const links = [];
    const files = [];
    const seen = new Set();
    scope.find('a[href]').each((_, a) => {
      const href = $(a).attr('href') || '';
      if (!/^https?:/i.test(href) || seen.has(href)) return;
      seen.add(href);
      const item = { text: this._clean($(a).text()), url: href };
      if (href.includes('/pluginfile.php/')) files.push(item);
      else links.push(item);
    });

    const paragraphs = [];
    scope.find('p, li, h1, h2, h3, h4, tr').each((_, el) => {
      const t = this._clean($(el).text());
      if (t && !paragraphs.includes(t)) paragraphs.push(t);
    });
    const text = paragraphs.length ? paragraphs.join('\n') : this._clean(scope.text());

    return {
      cmid,
      url: `${this.baseUrl}/mod/page/view.php?id=${cmid}`,
      courseTitle,
      title,
      text,
      links,
      files,
    };
  }

  async getFolderContents(cmid) {
    const html = await this.getPageHtml(`/mod/folder/view.php?id=${cmid}`);
    const $ = cheerio.load(html);
    const title = this._clean($('#region-main h2, .page-header-headings h1').first().text());
    const files = [];
    const seen = new Set();
    $('#region-main a[href*="/pluginfile.php/"]').each((_, a) => {
      const href = $(a).attr('href');
      if (href && !seen.has(href)) {
        seen.add(href);
        files.push({ name: this._clean($(a).text()) || 'file', url: href });
      }
    });
    return { cmid, url: `${this.baseUrl}/mod/folder/view.php?id=${cmid}`, title, files };
  }

  async getAttendance(cmid) {
    const html = await this.getPageHtml(`/mod/attendance/view.php?id=${cmid}`);
    const $ = cheerio.load(html);
    const courseTitle = this._clean($('.page-header-headings h1, h1').first().text());
    const sessions = [];
    $('table.generaltable').first().find('tbody tr').each((_, tr) => {
      const cells = $(tr).find('td').map((__, td) => this._clean($(td).text())).get();
      if (cells.length >= 4) {
        sessions.push({
          date: cells[0] || '',
          description: cells[1] || '',
          status: cells[2] || '',
          points: cells[3] || '',
          remarks: cells[4] || '',
        });
      }
    });
    const summary = {};
    $('table.attlist tr').each((_, tr) => {
      const k = this._clean($(tr).find('th, td').eq(0).text());
      const v = this._clean($(tr).find('td').last().text());
      if (k && v) summary[k] = v;
    });
    return {
      cmid,
      url: `${this.baseUrl}/mod/attendance/view.php?id=${cmid}`,
      courseTitle,
      sessions,
      summary,
    };
  }

  async getCalendarEvents(timeFrom, timeTo, limit = 20) {
    return await this.apiCall(
      'core_calendar_get_action_events_by_timesort',
      {
        limitnum: limit,
        timesortfrom: timeFrom,
        timesortto: timeTo,
        limittononsuspendedevents: true,
      },
    );
  }

  async getCalendarEventsByCourse(courseId, limit = 20) {
    return await this.apiCall(
      'core_calendar_get_action_events_by_course',
      { courseid: courseId, limitnum: limit },
    );
  }

  async getForums(courseIds) {
    try {
      const res = await this.apiCall(
        'mod_forum_get_forums_by_courses',
        { courseids: courseIds },
      );
      if (Array.isArray(res)) return res;
    } catch (e) {
      if (!(e instanceof APIError)) throw e;
    }

    const forums = [];
    for (const cid of courseIds) {
      const sections = await this._scrapeCourseContentsHtml(cid);
      for (const sec of sections) {
        for (const mod of sec.modules) {
          if (mod.modname !== 'forum' || !mod.id) continue;
          const isNews = /announcement|duyuru/i.test(mod.name || '');
          forums.push({
            id: mod.id,
            cmid: mod.id,
            course: cid,
            name: mod.name || 'Forum',
            type: isNews ? 'news' : 'general',
            numdiscussions: null,
            url: mod.url || `${this.baseUrl}/mod/forum/view.php?id=${mod.id}`,
            source: 'html',
          });
        }
      }
    }
    return forums;
  }

  async getForumDiscussions(forumId) {
    try {
      const res = await this.apiCall(
        'mod_forum_get_forum_discussions',
        { forumid: forumId, sortby: 'timemodified', sortdirection: 'DESC' },
      );
      if (res && Array.isArray(res.discussions)) return res;
    } catch (e) {
      if (!(e instanceof APIError)) throw e;
    }

    const html = await this.getPageHtml(`/mod/forum/view.php?id=${forumId}`);
    const $ = cheerio.load(html);
    const discussions = [];
    const seen = new Set();

    $('table.discussion-list tbody tr, tr.discussion').each((_, tr) => {
      const $tr = $(tr);
      const link = $tr.find('a[href*="/mod/forum/discuss.php"]').first();
      if (!link.length) return;
      const href = link.attr('href') || '';
      const dMatch = href.match(/[?&]d=(\d+)/);
      const discussionId = dMatch ? parseInt(dMatch[1], 10) : null;
      if (!discussionId || seen.has(discussionId)) return;
      seen.add(discussionId);

      const cells = $tr.find('td, th').map((__, el) => this._clean($(el).text())).get();
      const author = this._clean($tr.find('td.author, .author-info').first().text()) || (cells[2] || '');
      const dateEl = $tr.find('time').first();
      const dateText = this._clean(dateEl.attr('datetime') || dateEl.text() || '');
      const created = this._parseDateTs(dateText);
      const repliesText = this._clean($tr.find('td.replies, td.text-center').last().text());

      discussions.push({
        id: discussionId,
        discussion: discussionId,
        name: this._clean(link.text()),
        userfullname: author,
        created,
        timemodified: created,
        dateText,
        numreplies: /^\d+$/.test(repliesText) ? parseInt(repliesText, 10) : null,
        url: href,
        message: '',
        source: 'html',
      });
    });

    return { discussions, source: 'html' };
  }

  async getDiscussionDetail(discussionId) {
    const html = await this.getPageHtml(`/mod/forum/discuss.php?d=${discussionId}`);
    const $ = cheerio.load(html);
    const posts = [];

    $('.forumpost').each((_, el) => {
      const $post = $(el);
      const subject = this._clean($post.find('.subject, h3.h6').first().text());
      const authorHeader = this._clean($post.find('.author, header div.mb-3').first().text());
      const timeEl = $post.find('time').first();
      const dateText = this._clean(timeEl.attr('datetime') || timeEl.text() || '');
      const body = $post.find('.posting, .post-content-container').first();

      const paragraphs = [];
      body.find('p, li, h1, h2, h3, h4').each((__, item) => {
        const t = this._clean($(item).text());
        if (t && !paragraphs.includes(t)) paragraphs.push(t);
      });
      const message = paragraphs.length ? paragraphs.join('\n') : this._clean(body.text());

      const attachments = [];
      const seen = new Set();
      $post.find('a[href*="/pluginfile.php/"]').each((__, a) => {
        const href = $(a).attr('href');
        if (href && !seen.has(href)) {
          seen.add(href);
          attachments.push({ name: this._clean($(a).text()) || 'attachment', url: href });
        }
      });

      posts.push({
        subject,
        author: authorHeader,
        dateText,
        created: this._parseDateTs(dateText),
        message,
        attachments,
      });
    });

    return {
      discussionId,
      url: `${this.baseUrl}/mod/forum/discuss.php?d=${discussionId}`,
      posts,
    };
  }

  async getAnnouncements(courseIds, limitPerCourse = 5, courseNames = {}) {
    const allForums = await this.getForums(courseIds);
    const newsForums = allForums.filter(f => f.type === 'news');
    const results = [];

    for (const forum of newsForums) {
      try {
        const data = await this.getForumDiscussions(forum.id);
        const discussions = (data.discussions || []).slice(0, limitPerCourse);
        for (const d of discussions) {
          let message = d.message ? d.message.replace(/<[^>]+>/g, '').trim() : '';
          let author = d.userfullname || '?';
          let created = d.created || 0;
          let dateText = d.dateText || '';
          let attachments = [];
          const discussionId = d.discussion || d.id;

          if (!message && discussionId) {
            try {
              const detail = await this.getDiscussionDetail(discussionId);
              const firstPost = detail.posts[0];
              if (firstPost) {
                message = firstPost.message || '';
                if (!author || author === '?') author = firstPost.author || '?';
                if (!created) created = firstPost.created || 0;
                if (!dateText) dateText = firstPost.dateText || '';
                attachments = firstPost.attachments || [];
              }
            } catch { /* keep partial discussion metadata */ }
          }

          results.push({
            course: courseNames[forum.course] || `Course ${forum.course}`,
            courseId: forum.course,
            forumId: forum.id,
            discussionId,
            name: d.name || '?',
            author,
            created,
            modified: d.timemodified || created,
            dateText,
            message,
            attachments,
            url: d.url || `${this.baseUrl}/mod/forum/discuss.php?d=${discussionId}`,
          });
        }
      } catch { /* skip errored forum */ }
    }

    results.sort((a, b) => (b.created || 0) - (a.created || 0));
    return results;
  }

  async fetchResource(urlOrPath, _retried = false) {
    const target = new URL(urlOrPath, this.baseUrl);
    if (target.origin !== new URL(this.baseUrl).origin) {
      throw new APIError(`Refusing to send ODTUClass session to external host: ${target.host}`);
    }
    const resp = await this._request('GET', target.href, null, { responseType: 'arraybuffer' });
    if (!_retried && this._isLoginPage(resp) && this._canAutoReLogin()) {
      await this._autoReLogin();
      return await this.fetchResource(urlOrPath, true);
    }
    if ((resp.finalUrl || '').includes('/login/index.php')) {
      throw new AuthError('Session expired. Run: odtu login');
    }

    const contentType = resp.headers?.['content-type'] || '';
    const isHtml = contentType.toLowerCase().includes('text/html');
    const isText = isHtml || contentType.toLowerCase().startsWith('text/') || contentType.toLowerCase().includes('json');

    if (!isText) {
      return {
        url: resp.finalUrl || target.href,
        contentType,
        isBinary: true,
        buffer: Buffer.from(resp.data),
      };
    }

    const raw = Buffer.from(resp.data).toString('utf8');
    if (!isHtml) {
      return {
        url: resp.finalUrl || target.href,
        contentType,
        isBinary: false,
        raw,
        text: raw,
      };
    }

    const $ = cheerio.load(raw);
    const title = this._clean($('#region-main h2, .page-header-headings h1, title').first().text());
    const main = $('#region-main').length ? $('#region-main') : $('body');
    const links = [];
    const files = [];
    const seen = new Set();
    main.find('a[href]').each((_, a) => {
      const href = $(a).attr('href') || '';
      if (!/^https?:/i.test(href) || seen.has(href)) return;
      seen.add(href);
      const entry = { text: this._clean($(a).text()), url: href };
      if (href.includes('/pluginfile.php/')) files.push(entry);
      else links.push(entry);
    });

    const lines = [];
    main.find('h1, h2, h3, h4, p, li, tr').each((_, el) => {
      const t = this._clean($(el).text());
      if (t && !lines.includes(t)) lines.push(t);
    });

    return {
      url: resp.finalUrl || target.href,
      contentType,
      isBinary: false,
      title,
      text: lines.length ? lines.join('\n') : this._clean(main.text()),
      raw,
      links,
      files,
    };
  }

  async getSiteInfo() {
    return await this.apiCall('core_webservice_get_site_info', {});
  }

  async getPageHtml(path, _retried = false) {
    const resp = await this._request('GET', `${this.baseUrl}${path}`);
    if (!_retried && this._isLoginPage(resp) && this._canAutoReLogin()) {
      try {
        await this._autoReLogin();
        return await this.getPageHtml(path, true);
      } catch { /* re-login failed, return what we got */ }
    }
    return resp.data;
  }
}

export function getClient(checkAuth = true) {
  const client = new ODTUClassClient();
  if (checkAuth) client.ensureAuth();
  return client;
}
