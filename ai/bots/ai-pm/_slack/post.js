// ai-pm Slack 발신 헬퍼 — chat.postMessage / chat.update 를 안전하게 수행한다.
//
// 왜 필요한가: 한글 본문을 셸에서 인라인 JSON 으로 조립해 curl 로 보내면 두 함정에 빠진다.
//   (1) 한글 인코딩 손상 (인라인 JSON), (2) PowerShell 에서 `Get-Content | ConvertTo-Json`
//   시 문자열에 붙는 ETS 노트 속성(PSPath·PSChildName·ReadCount 등)까지 직렬화되어
//   `{"value":"...본문...","PSPath":...}` 덩어리가 text 자리에 통째로 들어간다.
// 이 헬퍼는 본문을 항상 UTF-8 파일에서 [string] 그대로 읽어 @slack/web-api 로 보낸다 —
// JSON 조립·인코딩·이스케이프를 셸이 아니라 node 가 처리하므로 두 함정이 모두 사라진다.
//
// 사용 (세션 래퍼가 node --env-file 로 .env 를 주입한 뒤 호출):
//   node --env-file=ai/bots/ai-pm/_slack/.env ai/bots/ai-pm/_slack/post.js \
//        --channel C0BF874CHUL --thread-ts 1720000000.000100 --text-file <path>
//   node ... post.js --channel C.. --update-ts 1720000000.000200 --text-file <path>   (chat.update)
//   node ... post.js --channel C.. --text-file <path> --blocks-file <path.json>        (선택)
//
// 성공 시 stdout 에 응답 좌표를 한 줄 JSON 으로 출력한다: {"ok":true,"channel":"C..","ts":"..."}.
// 실패 시 stderr 에 사유를 쓰고 exit code 1 로 종료한다(에러를 조용히 넘기지 않는다).

const fs = require('fs');
const { WebClient } = require('@slack/web-api');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function fail(msg) {
  process.stderr.write(`[ai-pm][post] ${msg}\n`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

const token = process.env.SLACK_BOT_TOKEN;
if (!token) fail('SLACK_BOT_TOKEN 미설정 — node --env-file=..._slack/.env 로 실행했는지 확인');

const channel = args.channel;
if (!channel) fail('--channel 필수');

if (!args['text-file']) fail('--text-file 필수 (본문을 UTF-8 파일로 기록한 뒤 그 경로를 전달)');

let text;
try {
  // [string] 그대로 읽는다 — ETS 노트 속성이 붙지 않아 text 오염이 원천 차단된다.
  text = fs.readFileSync(args['text-file'], 'utf8');
} catch (e) {
  fail(`본문 파일 읽기 실패 (${args['text-file']}): ${e.message}`);
}

// 윈도우 쓰기측 방어 — 세션이 PowerShell 로 임시 파일을 만들면 흔히 오염되는 두 가지를 정규화한다.
//   (1) UTF-8 BOM: PowerShell 5.1 의 `Out-File/Set-Content -Encoding utf8` 은 BOM 을 붙인다 →
//       맨 앞 U+FEFF 가 Slack 메시지 첫 글자로 새어나온다. 선두 BOM 만 제거한다.
//   (2) CRLF: 윈도우 줄바꿈 `\r\n` 이 메시지에 `\r` 을 남겨 렌더가 어긋날 수 있다 → LF 로 정규화.
// 끝의 잉여 줄바꿈도 정리한다(파일 말미 개행이 Slack 에 빈 줄로 남지 않도록). 본문 중간 서식은 보존한다.
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
text = text.replace(/\r\n/g, '\n').replace(/[\r\n]+$/, '');

if (!text) fail(`본문이 비어 있음 (${args['text-file']}) — 정규화 후 내용 없음`);

let blocks;
if (args['blocks-file']) {
  try {
    blocks = JSON.parse(fs.readFileSync(args['blocks-file'], 'utf8'));
  } catch (e) {
    fail(`blocks 파일 파싱 실패 (${args['blocks-file']}): ${e.message}`);
  }
}

const web = new WebClient(token);

(async () => {
  try {
    let res;
    if (args['update-ts']) {
      // chat.update — 기존 메시지의 상태 갱신(재알림 없음).
      res = await web.chat.update({ channel, ts: args['update-ts'], text, ...(blocks ? { blocks } : {}) });
    } else {
      res = await web.chat.postMessage({
        channel,
        text,
        ...(args['thread-ts'] ? { thread_ts: args['thread-ts'] } : {}),
        ...(blocks ? { blocks } : {}),
      });
    }
    process.stdout.write(JSON.stringify({ ok: true, channel: res.channel, ts: res.ts }) + '\n');
  } catch (e) {
    fail(`Slack API 실패: ${e?.data?.error || e?.message || e}`);
  }
})();
