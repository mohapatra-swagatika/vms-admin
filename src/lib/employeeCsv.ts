/** Keep in sync with backend employeeCsv.js */

export const EMPLOYEE_CSV_REQUIRED_HEADERS = ['name'] as const;
export const EMPLOYEE_CSV_OPTIONAL_HEADERS = ['email', 'phone', 'employee_code', 'department', 'job_title'] as const;
export const EMPLOYEE_CSV_KNOWN_HEADERS = [...EMPLOYEE_CSV_REQUIRED_HEADERS, ...EMPLOYEE_CSV_OPTIONAL_HEADERS] as const;

function detectDelimiter(line: string): string {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    const count = line.split(d).length;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return bestCount > 1 ? best : ',';
}

function parseCsvLine(line: string, delimiter = ','): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/^"|"$/g, '').trim();
}

export function parseEmployeeCsvHeaders(csvText: string): string[] {
  const firstLine = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).find(l => l.trim());
  if (!firstLine) return [];
  const delimiter = detectDelimiter(firstLine);
  return parseCsvLine(firstLine, delimiter).map(normalizeHeader).filter(Boolean);
}

/** Client-side header check before upload (mirrors backend validateHeaders). */
export function validateEmployeeCsvHeaders(csvText: string): string | null {
  const headers = parseEmployeeCsvHeaders(csvText);
  if (!headers.length) {
    return 'CSV header row is empty or could not be parsed. Use comma, semicolon, or tab as the delimiter.';
  }
  if (!headers.includes('name')) {
    return `Missing required column: name. Supported columns: ${EMPLOYEE_CSV_KNOWN_HEADERS.join(', ')}`;
  }
  return null;
}
