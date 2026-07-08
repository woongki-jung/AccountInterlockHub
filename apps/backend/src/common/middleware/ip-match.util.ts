import { isIP } from 'net';

/**
 * 관리자 IP 접근 제어(FN-001·SEC-001-01)용 IP 정규화·매칭 유틸.
 *
 * 운영 구성값(ADMIN_IP_ALLOWLIST)의 허용 항목을 "정확 IP" 또는 "CIDR" 로 대조한다.
 * 코드에 허용 IP 를 하드코딩하지 않으며(SEC-001-02), 매칭은 경량 비트 연산만 수행한다(PROC-104 성능 요구).
 */

/**
 * 출발지 IP 정규화 — IPv4-mapped IPv6(`::ffff:127.0.0.1`, `::ffff:7f00:1`)를 순수 IPv4 로 환원하고
 * IPv6 zone id(`%eth0`)·공백을 제거한다. 소켓·헤더가 주는 표기 편차를 흡수해 허용목록과 정확히 대조되게 한다.
 */
export function normalizeIp(raw: string | undefined | null): string {
  if (raw == null) {
    return '';
  }
  let ip = String(raw).trim();
  if (ip.length === 0) {
    return '';
  }
  // IPv6 zone id 제거 (fe80::1%eth0 → fe80::1)
  const zoneIdx = ip.indexOf('%');
  if (zoneIdx >= 0) {
    ip = ip.slice(0, zoneIdx);
  }
  // IPv4-mapped IPv6 환원: `::ffff:` 접두 뒤가 IPv4(점 표기)면 그대로, 16진 표기면 점 표기로 변환.
  const lower = ip.toLowerCase();
  if (lower.startsWith('::ffff:')) {
    const rest = ip.slice(7);
    if (isIP(rest) === 4) {
      return rest;
    }
    // `::ffff:7f00:1` 형태(16진 2그룹) → IPv4 점 표기
    const hexMatch = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(rest);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      if (isIP(v4) === 4) {
        return v4;
      }
    }
  }
  return ip;
}

interface ParsedIp {
  value: bigint;
  bits: 32 | 128;
}

// IPv4 점 표기 → 32비트 정수.
function parseIpv4(ip: string): bigint | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }
  let value = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const n = Number(part);
    if (n > 255) {
      return null;
    }
    value = (value << 8n) | BigInt(n);
  }
  return value;
}

// IPv6 표기(축약 `::`·말미 IPv4 임베드 포함) → 128비트 정수.
function parseIpv6(ip: string): bigint | null {
  const halves = ip.split('::');
  if (halves.length > 2) {
    return null;
  }

  const toGroups = (segment: string): number[] | null => {
    if (segment.length === 0) {
      return [];
    }
    const groups: number[] = [];
    for (const token of segment.split(':')) {
      if (token.includes('.')) {
        // 말미 IPv4 임베드(예: ::ffff:1.2.3.4) → 16비트 2그룹
        const v4 = parseIpv4(token);
        if (v4 === null) {
          return null;
        }
        groups.push(Number((v4 >> 16n) & 0xffffn));
        groups.push(Number(v4 & 0xffffn));
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(token)) {
          return null;
        }
        groups.push(parseInt(token, 16));
      }
    }
    return groups;
  };

  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (head === null || tail === null) {
    return null;
  }

  let full: number[];
  if (halves.length === 2) {
    const fillCount = 8 - head.length - tail.length;
    if (fillCount < 0) {
      return null;
    }
    full = [...head, ...new Array(fillCount).fill(0), ...tail];
  } else {
    full = head;
  }
  if (full.length !== 8) {
    return null;
  }

  let value = 0n;
  for (const group of full) {
    value = (value << 16n) | BigInt(group);
  }
  return value;
}

function parseIp(ip: string): ParsedIp | null {
  const family = isIP(ip);
  if (family === 4) {
    const value = parseIpv4(ip);
    return value === null ? null : { value, bits: 32 };
  }
  if (family === 6) {
    const value = parseIpv6(ip);
    return value === null ? null : { value, bits: 128 };
  }
  return null;
}

function fullMask(bits: 32 | 128): bigint {
  return (1n << BigInt(bits)) - 1n;
}

// prefixLen 상위 비트만 남기는 네트워크 마스크.
function prefixMask(bits: 32 | 128, prefixLen: number): bigint {
  if (prefixLen <= 0) {
    return 0n;
  }
  if (prefixLen >= bits) {
    return fullMask(bits);
  }
  return (fullMask(bits) >> BigInt(bits - prefixLen)) << BigInt(bits - prefixLen);
}

/**
 * 단일 허용 항목 대조 — 정확 IP(예: `203.0.113.7`) 또는 CIDR(예: `203.0.113.0/24`, `2001:db8::/32`).
 * 출발지·허용 항목의 IP 패밀리(v4/v6)가 다르면 매칭하지 않는다.
 */
export function ipMatchesEntry(sourceIp: string, entry: string): boolean {
  const trimmed = entry.trim();
  if (trimmed.length === 0) {
    return false;
  }
  const src = parseIp(sourceIp);
  if (src === null) {
    return false;
  }

  const slashIdx = trimmed.indexOf('/');
  const baseStr = slashIdx >= 0 ? trimmed.slice(0, slashIdx) : trimmed;
  const base = parseIp(baseStr);
  if (base === null || base.bits !== src.bits) {
    return false;
  }

  let prefixLen: number = base.bits;
  if (slashIdx >= 0) {
    const raw = trimmed.slice(slashIdx + 1);
    if (!/^\d{1,3}$/.test(raw)) {
      return false;
    }
    prefixLen = Number(raw);
    if (prefixLen > base.bits) {
      return false;
    }
  }

  const mask = prefixMask(base.bits, prefixLen);
  return (src.value & mask) === (base.value & mask);
}

/** 허용 목록 중 하나라도 대조되면 통과. 정규화는 호출부(미들웨어)가 수행한 값을 받는다. */
export function matchesAny(sourceIp: string, allowList: string[]): boolean {
  for (const entry of allowList) {
    if (ipMatchesEntry(sourceIp, entry)) {
      return true;
    }
  }
  return false;
}

/** `ADMIN_IP_ALLOWLIST` 콤마 구분 문자열을 허용 항목 배열로 파싱(공백·빈 항목 제거). */
export function parseAllowList(raw: string | undefined | null): string[] {
  if (raw == null) {
    return [];
  }
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
