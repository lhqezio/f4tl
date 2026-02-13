import type { LogEntry, LogLevel } from '../../types/index.js';

// Combined Log Format (Apache/nginx):
// 127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /path HTTP/1.0" 200 2326 "http://ref" "UA"
const CLF_REGEX =
  /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+(\S+)"\s+(\d{3})\s+(\S+)(?:\s+"([^"]*)")?\s*(?:"([^"]*)")?/;

const CLF_DATE_REGEX = /^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})/;

const MONTHS: Record<string, string> = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

function parseClfDate(dateStr: string): number {
  const m = CLF_DATE_REGEX.exec(dateStr);
  if (!m) return Date.now();
  const [, day, month, year, hour, min, sec, tz] = m;
  const iso = `${year}-${MONTHS[month] ?? '01'}-${day}T${hour}:${min}:${sec}${tz.slice(0, 3)}:${tz.slice(3)}`;
  const d = new Date(iso).getTime();
  return isNaN(d) ? Date.now() : d;
}

function statusToLevel(status: number): LogLevel {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
}

export function parseClfLine(source: string, line: string): LogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const m = CLF_REGEX.exec(trimmed);
  if (!m) return null;

  const [, ip, , user, dateStr, method, path, , statusStr, sizeStr, referer, userAgent] = m;
  const status = parseInt(statusStr, 10);

  return {
    source,
    level: statusToLevel(status),
    message: `${method} ${path} ${status}`,
    timestamp: parseClfDate(dateStr),
    metadata: {
      ip,
      user: user === '-' ? undefined : user,
      method,
      path,
      status,
      size: sizeStr === '-' ? 0 : parseInt(sizeStr, 10),
      referer: referer || undefined,
      userAgent: userAgent || undefined,
    },
  };
}
