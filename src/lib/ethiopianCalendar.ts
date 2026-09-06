// Ethiopian Calendar (የኢትዮጵያ ዘመን አቆጣጠር) Bidirectional Conversion & Formatting Utility

export interface EthiopianDate {
  year: number;
  month: number; // 1 to 13 (1: Meskerem .. 12: Nehase, 13: Pagume)
  day: number; // 1 to 30 (1 to 5 or 6 for Pagume)
}

export const ETHIOPIAN_MONTHS_AMHARIC = [
  'መስከረም',
  'ጥቅምት',
  'ህዳር',
  'ታህሳስ',
  'ጥር',
  'የካቲት',
  'መጋቢት',
  'ሚያዝያ',
  'ግንቦት',
  'ሰኔ',
  'ሐምሌ',
  'ነሐሴ',
  'ጳጉሜ',
];

export const ETHIOPIAN_MONTHS_ENGLISH = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miyazya',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume',
];

/**
 * Checks if an Ethiopian year is a leap year (with 6 Pagume days)
 */
export function isEthiopianLeapYear(year: number): boolean {
  return (year + 1) % 4 === 0 || year % 4 === 3;
}

/**
 * Maximum days in a given Ethiopian month
 */
export function getDaysInEthiopianMonth(year: number, month: number): number {
  if (month < 1 || month > 13) return 30;
  if (month <= 12) return 30;
  return isEthiopianLeapYear(year) ? 6 : 5;
}

/**
 * Convert Gregorian date (year, month, day) to Julian Day Number (JDN)
 */
export function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/**
 * Convert Julian Day Number (JDN) to Gregorian date
 */
export function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);

  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);

  return { year, month, day };
}

/**
 * Convert Ethiopian date to Julian Day Number (JDN)
 */
export function ethiopianToJdn(year: number, month: number, day: number): number {
  return 1723856 + 365 * (year - 1) + Math.floor(year / 4) + 30 * (month - 1) + day - 1;
}

/**
 * Convert Julian Day Number (JDN) to Ethiopian date
 */
export function jdnToEthiopian(jdn: number): EthiopianDate {
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  return { year, month, day };
}

/**
 * Convert a JavaScript Date (or ISO string or Y,M,D) to Ethiopian Date
 */
export function toEthiopian(date: Date | string | number, month?: number, day?: number): EthiopianDate {
  let gYear: number;
  let gMonth: number;
  let gDay: number;

  if (typeof date === 'number' && month !== undefined && day !== undefined) {
    gYear = date;
    gMonth = month;
    gDay = day;
  } else if (date instanceof Date) {
    gYear = date.getFullYear();
    gMonth = date.getMonth() + 1;
    gDay = date.getDate();
  } else {
    const d = new Date(String(date));
    if (isNaN(d.getTime())) {
      // Return today's Ethiopian date if invalid
      return toEthiopian(new Date());
    }
    gYear = d.getFullYear();
    gMonth = d.getMonth() + 1;
    gDay = d.getDate();
  }

  const jdn = gregorianToJdn(gYear, gMonth, gDay);
  return jdnToEthiopian(jdn);
}

/**
 * Convert Ethiopian date to Gregorian JavaScript Date
 */
export function toGregorian(ethYear: number, ethMonth: number, ethDay: number): Date {
  const jdn = ethiopianToJdn(ethYear, ethMonth, ethDay);
  const { year, month, day } = jdnToGregorian(jdn);
  return new Date(year, month - 1, day);
}

/**
 * Get Today's Ethiopian Date with all format representations
 */
export function getTodayEthiopian(): EthiopianDate & {
  formattedSlash: string; // e.g. "25/12/2018"
  formattedEC: string; // e.g. "25/12/2018 E.C."
  formattedAmharic: string; // e.g. "25 ነሐሴ 2018"
  formattedEnglish: string; // e.g. "25 Nehase 2018"
  formattedIso: string; // e.g. "2018-12-25"
} {
  const now = new Date();
  const eth = toEthiopian(now);
  const dayStr = String(eth.day).padStart(2, '0');
  const monthStr = String(eth.month).padStart(2, '0');
  const monthAm = ETHIOPIAN_MONTHS_AMHARIC[eth.month - 1] || 'ነሐሴ';
  const monthEn = ETHIOPIAN_MONTHS_ENGLISH[eth.month - 1] || 'Nehase';

  return {
    ...eth,
    formattedSlash: `${dayStr}/${monthStr}/${eth.year}`,
    formattedEC: `${dayStr}/${monthStr}/${eth.year} E.C.`,
    formattedAmharic: `${eth.day} ${monthAm} ${eth.year}`,
    formattedEnglish: `${eth.day} ${monthEn} ${eth.year}`,
    formattedIso: `${eth.year}-${monthStr}-${dayStr}`,
  };
}

/**
 * Format an Ethiopian date object or string into desired format
 */
export function formatEthiopian(
  input: EthiopianDate | Date | string,
  format: 'DD/MM/YYYY' | 'DD/MM/YYYY E.C.' | 'Amharic' | 'English' | 'YYYY-MM-DD' = 'DD/MM/YYYY'
): string {
  let eth: EthiopianDate;

  if (typeof input === 'object' && 'year' in input && 'month' in input && 'day' in input) {
    eth = input as EthiopianDate;
  } else if (input instanceof Date) {
    eth = toEthiopian(input);
  } else if (typeof input === 'string') {
    // Check if input is already an Ethiopian formatted string e.g. "25/12/2018"
    const parsed = parseEthiopianString(input);
    if (parsed) {
      eth = parsed;
    } else {
      const gDate = new Date(input);
      if (!isNaN(gDate.getTime())) {
        eth = toEthiopian(gDate);
      } else {
        return input;
      }
    }
  } else {
    eth = toEthiopian(new Date());
  }

  const dayStr = String(eth.day).padStart(2, '0');
  const monthStr = String(eth.month).padStart(2, '0');
  const monthAm = ETHIOPIAN_MONTHS_AMHARIC[eth.month - 1] || '';
  const monthEn = ETHIOPIAN_MONTHS_ENGLISH[eth.month - 1] || '';

  switch (format) {
    case 'DD/MM/YYYY':
      return `${dayStr}/${monthStr}/${eth.year}`;
    case 'DD/MM/YYYY E.C.':
      return `${dayStr}/${monthStr}/${eth.year} E.C.`;
    case 'Amharic':
      return `${eth.day} ${monthAm} ${eth.year}`;
    case 'English':
      return `${eth.day} ${monthEn} ${eth.year}`;
    case 'YYYY-MM-DD':
      return `${eth.year}-${monthStr}-${dayStr}`;
    default:
      return `${dayStr}/${monthStr}/${eth.year}`;
  }
}

/**
 * Parse various date strings into an Ethiopian Date
 * Handles:
 * - "25/12/2018"
 * - "25/12/2018 E.C."
 * - "2018-12-25"
 * - "25 ነሐሴ 2018"
 * - "25 Nehase 2018"
 * - "2026-08-31" (Gregorian fallback to conversion)
 */
export function parseEthiopianString(str: string): EthiopianDate | null {
  if (!str || typeof str !== 'string') return null;
  const clean = str.trim().replace(/E\.C\.|ዓ\.ም/gi, '').trim();

  // Pattern 1: DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);

    // If year is ~2000-2050 and month <= 13, it's Ethiopian
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 13 && day >= 1 && day <= 30) {
      return { year, month, day };
    }
  }

  // Pattern 2: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 13 && day >= 1 && day <= 30) {
      return { year, month, day };
    }
  }

  // Pattern 3: "25 ነሐሴ 2018" or "25 Nehase 2018"
  for (let m = 0; m < ETHIOPIAN_MONTHS_AMHARIC.length; m++) {
    const am = ETHIOPIAN_MONTHS_AMHARIC[m];
    const en = ETHIOPIAN_MONTHS_ENGLISH[m];
    if (clean.includes(am) || clean.toLowerCase().includes(en.toLowerCase())) {
      const parts = clean.split(/\s+/);
      let day = 1;
      let year = 2018;
      for (const p of parts) {
        const num = parseInt(p, 10);
        if (!isNaN(num)) {
          if (num > 1000) year = num;
          else if (num >= 1 && num <= 30) day = num;
        }
      }
      return { year, month: m + 1, day };
    }
  }

  return null;
}


