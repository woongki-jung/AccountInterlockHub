#!/usr/bin/env node
// Redmine MCP 서버 — 워크스페이스 세션이 Redmine 을 조작하는 통로(의존성 0 · Node 단일 파일 · stdio JSON-RPC).
//
// 운영 정본: ai/strategies/work-tracking-redmine.md (요소 식별자·이슈 조작·도구 함정).
// 등록:      claude mcp add redmine -s user -- node "<이 파일 절대경로>"
//            ⚠️ MCP 서버 이름은 반드시 `redmine` — ai/bots/ai-pm/mcp-curate.js 가 그 키로 추린다.
// 자격:      환경변수 REDMINE_BASE_URL·REDMINE_API_KEY 최우선 → 없으면 이 파일과 같은 위치의 .env 폴백.
//            (ai-pm 세션 래퍼는 ai/bots/ai-pm/.env 의 전용 봇 키를 env 로 주입한다 — 그때는 봇 정체성으로 작동.)
//
// 설계 원칙 — 문서화된 '도구 함정'(work-tracking-redmine.md §도구 함정)을 서버가 직접 막는다.
//   ① create_issue 가 tracker_id·status_id 를 무시하던 문제 → 생성 후 실측·교정·재검증한다.
//   ② update_issue 가 상태 전이 거부를 성공으로 삼키던 문제 → PUT 후 GET 실측으로 검증해 결과에 싣는다.
//   그 외 임의 조작은 redmine_request(범용 REST 패스스루)로 수행한다.
//
// stdout 은 JSON-RPC 전용이다 — 로그·진단은 반드시 stderr 로 낸다.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const SERVER_NAME = 'redmine';
const SERVER_VERSION = '1.0.0';
const DEFAULT_PROTOCOL = '2025-06-18';
const HERE = path.dirname(fileURLToPath(import.meta.url));

// --- 자격 로드 — env 최우선, 없으면 서버 파일 옆 .env 폴백 ---
function loadEnvFile(file) {
  const out = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !line.trimStart().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* 파일 없음 = 폴백 없음 */ }
  return out;
}
const fileEnv = loadEnvFile(path.join(HERE, '.env'));
const BASE_URL = (process.env.REDMINE_BASE_URL || fileEnv.REDMINE_BASE_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.REDMINE_API_KEY || fileEnv.REDMINE_API_KEY || '';

function log(msg) { process.stderr.write(`[redmine-mcp] ${msg}\n`); }

// --- Redmine REST 호출 ---
async function api(method, apiPath, body, opts = {}) {
  if (!BASE_URL || !API_KEY) {
    throw new Error('REDMINE_BASE_URL·REDMINE_API_KEY 미설정 — 환경변수 또는 서버 파일 옆 .env 를 확인한다.');
  }
  const url = BASE_URL + (apiPath.startsWith('/') ? apiPath : '/' + apiPath);
  const headers = { 'X-Redmine-API-Key': API_KEY, Accept: 'application/json' };
  let payload;
  if (opts.binary) {
    headers['Content-Type'] = 'application/octet-stream';
    payload = opts.binary;
  } else if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload });
  const text = await res.text();
  let parsed = null;
  if (text) { try { parsed = JSON.parse(text); } catch { parsed = { raw: text.slice(0, 2000) }; } }
  if (!res.ok) {
    const err = new Error(`Redmine ${method} ${apiPath} → HTTP ${res.status}`);
    err.detail = { status: res.status, body: parsed };
    throw err;
  }
  return { status: res.status, body: parsed }; // PUT/DELETE 성공은 204(본문 없음)
}

const qs = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined && v !== null && v !== '') p.append(k, String(v));
  const s = p.toString();
  return s ? '?' + s : '';
};
const num = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// --- 도구 정의 ---
const TOOLS = [
  {
    name: 'get_current_user',
    description: '현재 API 키의 Redmine 계정을 조회한다(작업 정체성 확인 — 봇 계정 vs admin).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_issues',
    description: '이슈 목록을 조회한다. status_id 는 기본 열린 이슈만 — 전체는 "*", 닫힘은 "closed".',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: '프로젝트 식별자 또는 id' },
        tracker_id: { type: 'number', description: '트래커 id (작업세션=7, 사양=6, 기능=2, 오류=1, 그룹=4, 검증=5, report=8)' },
        status_id: { type: 'string', description: '"*"(전체)·"open"·"closed"·상태 id' },
        assigned_to_id: { type: 'string' },
        category_id: { type: 'number' },
        fixed_version_id: { type: 'number' },
        parent_id: { type: 'number' },
        subject: { type: 'string', description: '제목 필터 (예: "~키워드")' },
        sort: { type: 'string', description: '예: updated_on:desc' },
        limit: { type: 'number', description: '기본 25, 최대 100' },
        offset: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_issue',
    description: '이슈 1건을 조회한다. include 로 journals(노트)·relations·children·attachments·allowed_statuses 를 함께 받는다.',
    inputSchema: {
      type: 'object',
      properties: {
        issue_id: { type: 'number' },
        include: { type: 'string', description: '쉼표 구분. 예: "journals,allowed_statuses"' },
      },
      required: ['issue_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_issue',
    description:
      '이슈를 생성한다. tracker_id·status_id 를 지정대로 반영하며, Redmine 이 무시하면 생성 후 PUT 으로 교정하고 GET 으로 실측 검증해 결과에 싣는다(work-tracking-redmine.md §도구 함정 ①).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: '프로젝트 식별자 또는 id (필수)' },
        subject: { type: 'string' },
        description: { type: 'string' },
        tracker_id: { type: 'number' },
        status_id: { type: 'number' },
        priority_id: { type: 'number' },
        assigned_to_id: { type: 'number' },
        category_id: { type: 'number' },
        fixed_version_id: { type: 'number' },
        parent_issue_id: { type: 'number' },
        custom_fields: { type: 'array', items: { type: 'object' } },
      },
      required: ['project_id', 'subject'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_issue',
    description:
      '이슈에 노트를 달거나 상태·담당자·필드를 변경한다. PUT 후 GET 으로 실측 검증하므로 상태 전이 거부를 성공으로 삼키지 않는다(work-tracking-redmine.md §도구 함정 ②).',
    inputSchema: {
      type: 'object',
      properties: {
        issue_id: { type: 'number' },
        notes: { type: 'string' },
        private_notes: { type: 'boolean' },
        status_id: { type: 'number' },
        assigned_to_id: { type: 'number' },
        subject: { type: 'string' },
        description: { type: 'string' },
        category_id: { type: 'number' },
        fixed_version_id: { type: 'number' },
        parent_issue_id: { type: 'number' },
        done_ratio: { type: 'number' },
      },
      required: ['issue_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_journal',
    description: '기존 노트(journal) 본문을 치환한다 — ai-pm 진행 노트 누적 갱신용(ai-pm.md §진행 피드백). 본문은 전체 치환이다.',
    inputSchema: {
      type: 'object',
      properties: { journal_id: { type: 'number' }, notes: { type: 'string' } },
      required: ['journal_id', 'notes'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_project',
    description: '프로젝트를 생성한다. tracker_ids 를 주면 생성 직후 활성 트래커를 그 목록으로 맞춘다(기본 트래커만 켜지는 함정 보완).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        identifier: { type: 'string' },
        description: { type: 'string' },
        is_public: { type: 'boolean' },
        parent_id: { type: 'number' },
        tracker_ids: { type: 'array', items: { type: 'number' } },
      },
      required: ['name', 'identifier'],
      additionalProperties: false,
    },
  },
  {
    name: 'upload_attachment',
    description: '로컬 파일을 업로드해 첨부 토큰을 받는다. 반환 token 을 update_issue 대신 redmine_request PUT /issues/<id>.json 의 uploads 로 붙인다.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: '업로드할 로컬 파일 절대경로' },
        filename: { type: 'string', description: '미지정 시 파일명 사용' },
      },
      required: ['file_path'],
      additionalProperties: false,
    },
  },
  {
    name: 'redmine_request',
    description:
      'Redmine REST 범용 호출(GET/POST/PUT/DELETE). 전용 도구가 없는 조작(관계·카테고리·버전·멤버십·프로젝트 트래커 치환 등)에 쓴다. body 는 JSON 객체.',
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
        path: { type: 'string', description: '예: /issues.json, /issues/470.json?include=journals' },
        body: { type: 'object', description: 'POST/PUT 본문 (JSON)' },
      },
      required: ['method', 'path'],
      additionalProperties: false,
    },
  },
];

// --- 도구 구현 ---
const HANDLERS = {
  async get_current_user() {
    const r = await api('GET', '/users/current.json');
    return r.body;
  },

  async list_issues(a) {
    const r = await api('GET', '/issues.json' + qs({
      project_id: a.project_id, tracker_id: a.tracker_id, status_id: a.status_id,
      assigned_to_id: a.assigned_to_id, category_id: a.category_id, fixed_version_id: a.fixed_version_id,
      parent_id: a.parent_id, subject: a.subject, sort: a.sort, limit: a.limit ?? 25, offset: a.offset,
    }));
    return r.body;
  },

  async get_issue(a) {
    const r = await api('GET', `/issues/${num(a.issue_id)}.json` + qs({ include: a.include }));
    return r.body;
  },

  async create_issue(a) {
    const issue = {
      project_id: a.project_id, subject: a.subject, description: a.description,
      tracker_id: num(a.tracker_id), status_id: num(a.status_id), priority_id: num(a.priority_id),
      assigned_to_id: num(a.assigned_to_id), category_id: num(a.category_id),
      fixed_version_id: num(a.fixed_version_id), parent_issue_id: num(a.parent_issue_id),
      custom_fields: a.custom_fields,
    };
    for (const k of Object.keys(issue)) if (issue[k] === undefined) delete issue[k];
    const created = await api('POST', '/issues.json', { issue });
    const id = created.body.issue.id;

    // 생성 요청이 무시되는 케이스(예: Report 트래커의 status_id) 교정 — 지정값과 실측이 다르면 PUT 으로 맞춘다.
    const corrections = {};
    if (issue.tracker_id && Number(created.body.issue.tracker.id) !== issue.tracker_id) corrections.tracker_id = issue.tracker_id;
    if (issue.status_id && Number(created.body.issue.status.id) !== issue.status_id) corrections.status_id = issue.status_id;
    let corrected = false;
    if (Object.keys(corrections).length) {
      await api('PUT', `/issues/${id}.json`, { issue: corrections });
      corrected = true;
    }
    const after = await api('GET', `/issues/${id}.json`);
    const f = after.body.issue;
    const mismatch = [];
    if (issue.tracker_id && Number(f.tracker.id) !== issue.tracker_id) mismatch.push(`tracker_id 요청 ${issue.tracker_id} → 실제 ${f.tracker.id}`);
    if (issue.status_id && Number(f.status.id) !== issue.status_id) mismatch.push(`status_id 요청 ${issue.status_id} → 실제 ${f.status.id}`);
    return {
      ok: mismatch.length === 0,
      issue_id: id,
      verified: { tracker: f.tracker, status: f.status, closed_on: f.closed_on ?? null, subject: f.subject, project: f.project },
      corrected,
      ...(mismatch.length ? { warning: `생성 후 교정에도 값이 반영되지 않았다: ${mismatch.join(' / ')}` } : {}),
    };
  },

  async update_issue(a) {
    const id = num(a.issue_id);
    const issue = {
      notes: a.notes, private_notes: a.private_notes, status_id: num(a.status_id),
      assigned_to_id: num(a.assigned_to_id), subject: a.subject, description: a.description,
      category_id: num(a.category_id), fixed_version_id: num(a.fixed_version_id),
      parent_issue_id: num(a.parent_issue_id), done_ratio: num(a.done_ratio),
    };
    for (const k of Object.keys(issue)) if (issue[k] === undefined) delete issue[k];
    if (!Object.keys(issue).length) throw new Error('변경할 필드가 없다 — notes·status_id 등을 지정한다.');

    await api('PUT', `/issues/${id}.json`, { issue });
    // 실측 검증 — Redmine 은 상태 전이만 거부해도 PUT 을 성공으로 응답한다.
    const after = await api('GET', `/issues/${id}.json`, undefined);
    const f = after.body.issue;
    const wantStatus = num(a.status_id);
    const statusApplied = wantStatus === undefined ? null : Number(f.status.id) === wantStatus;
    const res = {
      ok: statusApplied !== false,
      issue_id: id,
      verified: { status: f.status, assigned_to: f.assigned_to ?? null, closed_on: f.closed_on ?? null, updated_on: f.updated_on },
      notes_added: Boolean(a.notes),
    };
    if (statusApplied === false) {
      let allowed = null;
      try {
        const inc = await api('GET', `/issues/${id}.json?include=allowed_statuses`);
        allowed = (inc.body.issue.allowed_statuses || []).map((s) => `${s.id}=${s.name}`);
      } catch { /* 구버전이면 allowed_statuses 없음 */ }
      res.warning = `상태 전이가 적용되지 않았다 — 요청 status_id ${wantStatus}, 실제 ${f.status.id}(${f.status.name}). 열린 하위 일감·워크플로 제약을 확인한다.`;
      if (allowed) res.allowed_statuses = allowed;
    }
    return res;
  },

  async update_journal(a) {
    await api('PUT', `/journals/${num(a.journal_id)}.json`, { journal: { notes: a.notes } });
    return { ok: true, journal_id: num(a.journal_id), note: '노트 수정은 이슈 updated_on 을 올리지 않는다(폴링 재트리거 없음).' };
  },

  async create_project(a) {
    const project = {
      name: a.name, identifier: a.identifier, description: a.description,
      is_public: a.is_public ?? false, parent_id: num(a.parent_id),
    };
    for (const k of Object.keys(project)) if (project[k] === undefined) delete project[k];
    const created = await api('POST', '/projects.json', { project });
    const id = created.body.project.id;
    let trackers = null;
    if (Array.isArray(a.tracker_ids) && a.tracker_ids.length) {
      // create_project 는 기본 트래커만 켠다 — 지정 목록으로 치환한다(치환 의미이므로 전체를 보낸다).
      await api('PUT', `/projects/${id}.json`, { project: { tracker_ids: a.tracker_ids.map(Number) } });
      const after = await api('GET', `/projects/${id}.json?include=trackers`);
      trackers = (after.body.project.trackers || []).map((t) => `${t.id}=${t.name}`);
    }
    return { ok: true, project_id: id, identifier: created.body.project.identifier, trackers };
  },

  async upload_attachment(a) {
    const buf = fs.readFileSync(a.file_path);
    const name = a.filename || path.basename(a.file_path);
    const r = await api('POST', '/uploads.json' + qs({ filename: name }), undefined, { binary: buf });
    return {
      ok: true, token: r.body.upload.token, filename: name, bytes: buf.length,
      next: 'redmine_request PUT /issues/<id>.json 본문 {"issue":{"uploads":[{"token":"<token>","filename":"<name>","content_type":"<MIME>"}]}}',
    };
  },

  async redmine_request(a) {
    const method = String(a.method).toUpperCase();
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) throw new Error(`지원하지 않는 method: ${a.method}`);
    const r = await api(method, a.path, a.body);
    return { status: r.status, body: r.body };
  },
};

// --- JSON-RPC (stdio) ---
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function reply(id, result) { send({ jsonrpc: '2.0', id, result }); }
function replyError(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

async function handle(req) {
  const { id, method, params } = req;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: params?.protocolVersion || DEFAULT_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return;
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, { tools: TOOLS });
    case 'resources/list':
      return reply(id, { resources: [] });
    case 'prompts/list':
      return reply(id, { prompts: [] });
    case 'tools/call': {
      const name = params?.name;
      const fn = HANDLERS[name];
      if (!fn) return replyError(id, -32602, `알 수 없는 도구: ${name}`);
      try {
        const out = await fn(params?.arguments || {});
        return reply(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        const detail = e && e.detail ? `\n${JSON.stringify(e.detail, null, 2)}` : '';
        return reply(id, {
          content: [{ type: 'text', text: `실패: ${(e && e.message) || e}${detail}` }],
          isError: true,
        });
      }
    }
    default:
      if (isNotification) return;
      return replyError(id, -32601, `지원하지 않는 method: ${method}`);
  }
}

if (!BASE_URL || !API_KEY) {
  log('경고: REDMINE_BASE_URL·REDMINE_API_KEY 미설정 — 도구 호출 시 실패한다(환경변수 또는 서버 파일 옆 .env).');
} else {
  log(`ready — base=${BASE_URL} (key ${API_KEY.slice(0, 4)}…)`);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const s = line.trim();
  if (!s) return;
  let req;
  try { req = JSON.parse(s); } catch { return log(`JSON 파싱 실패: ${s.slice(0, 200)}`); }
  Promise.resolve(handle(req)).catch((e) => {
    log(`처리 예외: ${(e && e.stack) || e}`);
    if (req && req.id !== undefined && req.id !== null) replyError(req.id, -32603, String((e && e.message) || e));
  });
});
rl.on('close', () => process.exit(0));
