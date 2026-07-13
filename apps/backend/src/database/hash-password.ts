import * as readline from 'readline';
import { hashPassword, validatePasswordComplexity } from '../admin/auth/password.util';
import { AppException } from '../common/envelope/app.exception';

/**
 * 관리자 비밀번호 해시 생성 CLI — 기능검증용 수동 계정 프로비저닝 보조.
 *
 * 비밀번호를 입력받아 앱과 동일한 bcrypt 해시(password.util.hashPassword, cost 10, 솔트 자동)를 출력한다.
 * 출력 해시를 TBL_ADMIN_ACCOUNT.password_hash 에 넣어 관리자 계정을 DB 에 직접 생성할 수 있다.
 *
 * 실행: `npm run hash-password`  (apps/backend 디렉터리에서)
 * - 대화형(TTY): 비밀번호 입력이 '*' 로 마스킹되며 평문을 화면·로그에 남기지 않는다(해시만 출력).
 * - 파이프 입력(비TTY): `echo '<pw>' | npm run hash-password` 도 지원(마스킹 없음).
 * - 복잡도(AUTH-001-02: 8자 이상 + 영대문자·소문자·숫자·특수문자 각 1자 이상) 미달 시 경고만 표시하고 해시는 출력한다.
 * - DB 접속은 하지 않는다(해시 생성 전용).
 */

function readPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const isTty = Boolean(process.stdin.isTTY);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: isTty,
    });

    if (isTty) {
      // 입력 에코 마스킹: 키 입력마다 현재 라인을 프롬프트 + '*'×길이 로 다시 그린다.
      const rlAny = rl as unknown as {
        line: string;
        output: NodeJS.WriteStream;
        _writeToOutput: (s: string) => void;
      };
      let muted = false;
      rlAny._writeToOutput = (stringToWrite: string) => {
        if (muted) {
          rlAny.output.write(
            '\x1B[2K\x1B[200D' + prompt + '*'.repeat((rlAny.line || '').length),
          );
        } else {
          rlAny.output.write(stringToWrite);
        }
      };
      rl.question(prompt, (answer) => {
        process.stdout.write('\n');
        rl.close();
        resolve(answer.replace(/\r$/, ''));
      });
      muted = true;
    } else {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.replace(/\r$/, ''));
      });
    }
  });
}

async function main(): Promise<void> {
  const pw = await readPassword('비밀번호를 입력하세요: ');
  if (!pw) {
    console.error('[hash-password] 빈 비밀번호입니다. 종료합니다.');
    process.exit(1);
  }

  try {
    validatePasswordComplexity(pw);
  } catch (err) {
    if (err instanceof AppException) {
      console.warn(
        '[hash-password] ⚠ 복잡도 미달 — 8자 이상 + 영대문자·소문자·숫자·특수문자 각 1자 이상(AUTH-001-02). 해시는 출력하지만 앱 정책상 권장되지 않습니다.',
      );
    } else {
      throw err;
    }
  }

  const hash = await hashPassword(pw);
  console.log('\n=== bcrypt 해시 (TBL_ADMIN_ACCOUNT.password_hash 값) ===');
  console.log(hash);
  console.log('\n-- 계정 생성 예시(psql) --');
  console.log(
    'INSERT INTO "TBL_ADMIN_ACCOUNT" (username, password_hash, is_active, failed_login_count, created_by)',
  );
  console.log(`VALUES ('admin', '${hash}', true, 0, 'manual');`);
}

main().catch((err) => {
  console.error('[hash-password] 실패:', err);
  process.exit(1);
});
