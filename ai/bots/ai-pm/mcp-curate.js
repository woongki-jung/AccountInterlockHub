// ai-pm MCP 큐레이터 — ~/.claude.json 에서 redmine MCP 서버만 추려 지정 경로에 기록한다.
//
// 왜: 인증 필요한 claude.ai 커넥터(Figma·Google 등)와 Playwright MCP 는 detached 세션의 MCP
//     초기화 단계를 막아 세션이 첫 턴에 도달하지 못하게 한다(ai/strategies/ai-pm.md §운영 연속성).
//     ai-pm 은 Redmine MCP 만 필요하므로(폴링·회신 = Redmine), redmine 서버만 추린 설정으로
//     세션 래퍼가 --strict-mcp-config 기동해 다른 MCP 소스를 전부 무시한다.
// node(JSON.parse)로 추출한다 — PowerShell 5.1 ConvertFrom-Json 은 대용량·중복키 .claude.json 에서 실패.
//
// 사용: node mcp-curate.js <출력경로>
//   성공: 출력경로에 {"mcpServers":{"redmine":{...}}} 기록 후 stdout 에 "OK".
//   redmine 미발견: stdout 에 "NO_REDMINE"(정상 종료). 파싱·IO 실패: stderr + exit 2.
const fs = require('fs');
const os = require('os');
const path = require('path');

const out = process.argv[2];
if (!out) {
  process.stderr.write('사용: node mcp-curate.js <출력경로>\n');
  process.exit(2);
}

try {
  const src = path.join(os.homedir(), '.claude.json');
  const cfg = JSON.parse(fs.readFileSync(src, 'utf8'));
  const redmine = cfg.mcpServers && cfg.mcpServers.redmine;
  if (!redmine) {
    process.stdout.write('NO_REDMINE');
    process.exit(0);
  }
  fs.writeFileSync(out, JSON.stringify({ mcpServers: { redmine } }, null, 2), 'utf8');
  process.stdout.write('OK');
} catch (e) {
  process.stderr.write(String((e && e.message) || e));
  process.exit(2);
}
