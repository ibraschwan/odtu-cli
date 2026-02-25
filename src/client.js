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
  return `https://odtuclass${year}${semester.toLowerCase()}.metu.edu.tr`;
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

  async _request(method, url, data = null, { json = false, params = null } = {}) {
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
      if (cs) redirectHeaders.Cookie = cs;

      resp = await axios({
        method: 'GET',
        url: location,
        headers: redirectHeaders,
        maxRedirects: 0,
        validateStatus: () => true,
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
    if (!this.sesskey) return false;
    try {
      const result = await this.apiCall('core_webservice_get_site_info', {});
      return 'userid' in result;
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

  async apiBatch(calls) {
    if (!calls.length) return [];
    const methodNames = calls.map(c => c[0]).join(',');
    const body = calls.map(([name, args], i) => ({ index: i, methodname: name, args }));

    const resp = await this._request(
      'POST',
      `${this.baseUrl}/lib/ajax/service.php`,
      body,
      { json: true, params: { sesskey: this.sesskey, info: methodNames } },
    );

    return resp.data.map(item => {
      if (item.error) {
        const err = item.exception || {};
        throw new APIError(err.message || 'API batch call failed');
      }
      return item.data !== undefined ? item.data : item;
    });
  }

  // ── High-level methods ─────────────────────────────────────────

  async getCourses(classification = 'all') {
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
  }

  async getCourseContents(courseId) {
    return await this.apiCall('core_course_get_contents', { courseid: courseId });
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
        if (m) courseId = parseInt(m[1]);
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
      `/course/user.php?mode=grade&id=${courseId}&user=${this.userId}`
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
      item.itemname = cells.eq(0).text().trim();

      cells.slice(1).each((i, cell) => {
        const idx = i + 1;
        const text = $(cell).text().trim();
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
      try {
        const sections = await this.getCourseContents(cid);
        for (const section of sections) {
          for (const mod of (section.modules || [])) {
            if (['assign', 'turnitintooltwo', 'quiz'].includes(mod.modname)) {
              const dates = {};
              for (const d of (mod.dates || [])) {
                const label = (d.label || '').toLowerCase();
                if (label.includes('due') || label.includes('close')) {
                  dates.duedate = d.timestamp || 0;
                } else if (label.includes('open')) {
                  dates.opendate = d.timestamp || 0;
                }
              }
              allAssignments.push({
                courseid: cid,
                cmid: mod.id,
                name: mod.name || '?',
                modname: mod.modname,
                duedate: dates.duedate || 0,
                opendate: dates.opendate || 0,
                url: mod.url || '',
              });
            }
          }
        }
      } catch (e) {
        if (e instanceof APIError) {
          await this._scrapeAssignmentsHtml(cid, allAssignments);
        } else {
          throw e;
        }
      }
    }
    return allAssignments;
  }

  async _scrapeAssignmentsHtml(courseId, result) {
    const html = await this.getPageHtml(`/course/view.php?id=${courseId}`);
    const $ = cheerio.load(html);
    $('li.activity').each((_, el) => {
      const $el = $(el);
      const classes = ($el.attr('class') || '').split(/\s+/);
      let modType = null;
      for (const cls of classes) {
        if (cls.startsWith('modtype_')) {
          modType = cls.replace('modtype_', '');
        }
      }
      if (!['assign', 'turnitintooltwo', 'quiz'].includes(modType)) return;
      let link = $el.find('a.aalink').first();
      if (!link.length) link = $el.find('a').first();
      if (!link.length) return;
      result.push({
        courseid: courseId,
        name: link.text().trim(),
        modname: modType,
        duedate: 0,
        url: link.attr('href') || '',
      });
    });
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
    return await this.apiCall(
      'mod_forum_get_forums_by_courses',
      { courseids: courseIds },
    );
  }

  async getForumDiscussions(forumId) {
    return await this.apiCall(
      'mod_forum_get_forum_discussions',
      { forumid: forumId, sortby: 'timemodified', sortdirection: 'DESC' },
    );
  }

  async getSiteInfo() {
    return await this.apiCall('core_webservice_get_site_info', {});
  }

  async getPageHtml(path, _retried = false) {
    const resp = await this._request('GET', `${this.baseUrl}${path}`);
    // If we got redirected to the login page, session expired
    const finalUrl = resp.finalUrl || '';
    if (!_retried && finalUrl.includes('/login/index.php') && this._canAutoReLogin()) {
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
