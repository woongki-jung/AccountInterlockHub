const path = require('path');
const fs = require('fs');
const { App, LogLevel } = require('@slack/bolt');

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')
);
const BOT = config.bot_name;
// ai-pm 은 단일 봇·단일 세션이다. app.js 는 담당 채널·DM·멘션 이벤트를 runtime.log 에 남기고,
// ai-pm 세션이 그 로그를 읽어 처리한다(ai/strategies/ai-pm.md §런타임 구성 요소).
// 봇 발신·시스템 메시지는 피드백 루프 방지로 로깅하지 않는다(§글로벌 운영 원칙 — 무응답 대상).

let SELF_USER_ID = null;
let SELF_BOT_ID = null;

// 처리 정체 감지용 마커 — 세션에 보일 이벤트(mention·DM·channel)를 로깅할 때마다 그 ts 를
// 기록한다(최신값 덮어쓰기). 워치독이 _session/last-processed 와 비교해 tail→처리 공백
// (세션이 새 로그를 다시 읽지 못하고 멈춘 상태)을 감지한다(ai/strategies/ai-pm.md §운영 연속성).
const LAST_EVENT_FILE = path.join(__dirname, 'last-event');
function markLastEvent(ts) {
  if (!ts) return;
  try {
    fs.writeFileSync(LAST_EVENT_FILE, String(ts), 'utf8');
  } catch (e) {
    console.error(`[${BOT}][last-event write failed] ${e?.message || e}`);
  }
}

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase() === 'debug'
    ? LogLevel.DEBUG
    : LogLevel.INFO,
});

const channelNameCache = new Map();
async function channelName(client, id) {
  if (channelNameCache.has(id)) return channelNameCache.get(id);
  try {
    const r = await client.conversations.info({ channel: id });
    const name = r.channel?.name ?? id;
    channelNameCache.set(id, name);
    return name;
  } catch {
    return id;
  }
}

const userNameCache = new Map();
async function userName(client, id) {
  if (!id) return 'unknown';
  if (userNameCache.has(id)) return userNameCache.get(id);
  try {
    const r = await client.users.info({ user: id });
    const name = r.user?.real_name || r.user?.name || id;
    userNameCache.set(id, name);
    return name;
  } catch {
    return id;
  }
}

app.event('app_mention', async ({ event, client }) => {
  const cname = await channelName(client, event.channel);
  const uname = await userName(client, event.user);
  console.log(`[${BOT}][APP_MENTION] ` + JSON.stringify({
    channel: event.channel,
    channel_name: cname,
    user: event.user,
    user_name: uname,
    ts: event.ts,
    thread_ts: event.thread_ts,
    text: event.text,
  }));
  markLastEvent(event.ts);
});

app.message(async ({ message, client }) => {
  // 자기 자신·타 봇 발신은 무시 (피드백 루프 방지)
  if (SELF_BOT_ID && message.bot_id === SELF_BOT_ID) return;
  if (SELF_USER_ID && message.user === SELF_USER_ID) return;
  if (message.bot_id) return;

  // 시스템성(subtype) 메시지 무시
  if (message.subtype) return;

  if (message.channel_type === 'im') {
    console.log(`[${BOT}][DM_MSG] ` + JSON.stringify({
      channel: message.channel,
      user: message.user,
      ts: message.ts,
      text: message.text,
    }));
    markLastEvent(message.ts);
    return;
  }

  // 봇 멘션이 포함된 채널 메시지는 app_mention 이벤트가 이미 커버한다 —
  // message 쪽에서도 로깅하면 같은 메시지가 두 번 남으므로 여기서는 스킵한다.
  // (DM 은 app_mention 이 발화하지 않으므로 위 im 분기에는 적용하지 않는다.)
  if (SELF_USER_ID && typeof message.text === 'string' && message.text.includes(`<@${SELF_USER_ID}>`)) return;

  const cname = await channelName(client, message.channel);
  const uname = await userName(client, message.user);
  console.log(`[${BOT}][CHANNEL_MSG] ` + JSON.stringify({
    channel: message.channel,
    channel_name: cname,
    channel_type: message.channel_type,
    user: message.user,
    user_name: uname,
    ts: message.ts,
    thread_ts: message.thread_ts,
    text: message.text,
  }));
  markLastEvent(message.ts);
});

app.command('/ping', async ({ ack, respond }) => {
  await ack();
  await respond({ response_type: 'ephemeral', text: `pong from ${BOT}` });
});

app.error(async (error) => {
  console.error(`[${BOT}][bolt error]`, error);
});

// === 크래시 가드 — socket-mode 의 "Unhandled event ... in state ..." 동기 throw 는
// app.error 로 잡히지 않아 프로세스를 죽인다. WSS 재연결 레이스면 삼켜 내부 재연결을 잇고,
// 그 외 알 수 없는 치명 오류는 종료해 세션 래퍼의 재기동에 맡긴다.
process.on('unhandledRejection', (reason) => {
  console.error(`[${BOT}][unhandledRejection] ${(reason && reason.message) || reason}`);
});
process.on('uncaughtException', (err) => {
  const msg = (err && err.message) || String(err);
  const recoverable = /Unhandled event '.*' in state '.*'|server explicit disconnect|socket[- ]?mode/i.test(msg);
  console.error(`[${BOT}][crash-guard] uncaughtException (${recoverable ? 'recoverable, continue' : 'fatal, exit'}): ${msg}`);
  if (!recoverable) process.exit(1);
});

(async () => {
  try {
    const auth = await app.client.auth.test();
    SELF_USER_ID = auth.user_id || null;
    SELF_BOT_ID = auth.bot_id || null;
  } catch (e) {
    console.error(`[${BOT}][auth.test failed]`, e?.data?.error || e?.message || e);
    // 토큰 오류가 명백한 상태로 떠 있어봐야 수신 불가·필터 무력화(self id 미상)뿐이다 —
    // 종료해 래퍼/워치독의 재기동 계약에 맡긴다.
    process.exit(1);
  }
  await app.start();
  console.log(`[${BOT}] Slack Bolt app running in Socket Mode. (self user=${SELF_USER_ID} bot=${SELF_BOT_ID})`);
})();

const shutdown = async (signal) => {
  console.log(`\n[${BOT}] Received ${signal}, stopping...`);
  try {
    await app.stop();
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
