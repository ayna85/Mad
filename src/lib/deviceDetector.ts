import { DeviceSession } from '../types';

export function parseUserAgent(): {
  browserName: string;
  browserVersion: string;
  deviceType: 'phone' | 'tablet' | 'computer';
  deviceName: string;
  osName: string;
} {
  const ua = navigator.userAgent || '';
  let browserName = 'Browser';
  let browserVersion = '';
  let deviceType: 'phone' | 'tablet' | 'computer' = 'computer';
  let osName = 'Unknown OS';
  let deviceName = 'Computer / PC';

  // 1. Detect Browser (including Opera, Opera Mobile/Touch, Chrome, Safari, Edge, Firefox, Samsung)
  if (ua.includes('OPT/') || ua.includes('Opera') || ua.includes('OPR/')) {
    browserName = 'Opera Browser';
    const match = ua.match(/(?:Opera|OPR|OPT)\/([0-9.]+)/);
    if (match) browserVersion = match[1];
  } else if (ua.includes('Edg/')) {
    browserName = 'Microsoft Edge';
    const match = ua.match(/Edg\/([0-9.]+)/);
    if (match) browserVersion = match[1];
  } else if (ua.includes('SamsungBrowser')) {
    browserName = 'Samsung Internet';
    const match = ua.match(/SamsungBrowser\/([0-9.]+)/);
    if (match) browserVersion = match[1];
  } else if (ua.includes('Chrome/') && !ua.includes('Chromium')) {
    browserName = 'Google Chrome';
    const match = ua.match(/Chrome\/([0-9.]+)/);
    if (match) browserVersion = match[1];
  } else if (ua.includes('Firefox/')) {
    browserName = 'Mozilla Firefox';
    const match = ua.match(/Firefox\/([0-9.]+)/);
    if (match) browserVersion = match[1];
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browserName = 'Apple Safari';
    const match = ua.match(/Version\/([0-9.]+)/);
    if (match) browserVersion = match[1];
  }

  // 2. Detect OS & Device Type
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/i.test(
    ua
  );

  if (/Android/i.test(ua)) {
    osName = 'Android';
    deviceType = isTablet ? 'tablet' : 'phone';

    // Parse phone model if available (e.g. "SM-G998B", "Pixel 7")
    const modelMatch = ua.match(/Android[^;]+;\s*([^;)]+)\)/);
    const rawModel = modelMatch ? modelMatch[1].trim() : 'Android Device';
    if (rawModel.toLowerCase().includes('samsung') || rawModel.startsWith('SM-') || rawModel.startsWith('GT-')) {
      deviceName = `Samsung Galaxy (${rawModel.replace(/^samsung\s*/i, '')})`;
    } else if (rawModel.toLowerCase().includes('pixel')) {
      deviceName = `Google ${rawModel}`;
    } else if (rawModel.toLowerCase().includes('redmi') || rawModel.toLowerCase().includes('mi ') || rawModel.toLowerCase().includes('xiaomi')) {
      deviceName = `Xiaomi / Redmi (${rawModel})`;
    } else if (rawModel.toLowerCase().includes('infinix') || rawModel.toLowerCase().includes('tecno')) {
      deviceName = `Transsion (${rawModel})`;
    } else {
      deviceName = `${rawModel} (Phone)`;
    }
  } else if (/iPhone/i.test(ua)) {
    osName = 'iOS';
    deviceType = 'phone';
    deviceName = 'Apple iPhone';
  } else if (/iPad/i.test(ua)) {
    osName = 'iPadOS';
    deviceType = 'tablet';
    deviceName = 'Apple iPad';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    osName = 'macOS';
    deviceType = 'computer';
    deviceName = 'Apple Mac / MacBook';
  } else if (/Windows NT 10.0/i.test(ua)) {
    osName = 'Windows 10/11';
    deviceType = 'computer';
    deviceName = 'Windows PC';
  } else if (/Windows/i.test(ua)) {
    osName = 'Windows';
    deviceType = 'computer';
    deviceName = 'Windows PC';
  } else if (/Linux/i.test(ua)) {
    osName = 'Linux';
    deviceType = 'computer';
    deviceName = 'Linux Workstation';
  }

  return {
    browserName,
    browserVersion,
    deviceType,
    deviceName,
    osName,
  };
}

export function getCurrentDeviceSession(userId: string): DeviceSession {
  const parsed = parseUserAgent();
  let deviceId = localStorage.getItem('mad_device_id');
  if (!deviceId) {
    deviceId = `dev_${crypto.randomUUID()}`;
    localStorage.setItem('mad_device_id', deviceId);
  }

  const now = new Date().toISOString();
  return {
    id: deviceId,
    user_id: userId,
    browser_name: parsed.browserName,
    browser_version: parsed.browserVersion,
    device_type: parsed.deviceType,
    device_name: parsed.deviceName,
    os_name: parsed.osName,
    is_current_device: true,
    created_at: now,
    last_active_at: now,
  };
}

export interface CurrentDeviceInfo {
  browserName: string;
  browserVersion: string;
  deviceType: 'phone' | 'tablet' | 'computer';
  deviceName: string;
  osName: string;
}

export function getCurrentDeviceInfo(): CurrentDeviceInfo {
  return parseUserAgent();
}

export function getDeviceEmoji(deviceType?: 'phone' | 'tablet' | 'computer'): string {
  if (deviceType === 'phone') return '📱';
  if (deviceType === 'tablet') return '📟';
  return '💻';
}

export function getBrowserEmoji(browserName?: string): string {
  const b = (browserName || '').toLowerCase();
  if (b.includes('opera')) return '🔴';
  if (b.includes('chrome')) return '🟢';
  if (b.includes('safari')) return '🧭';
  if (b.includes('edge')) return '🌊';
  if (b.includes('firefox')) return '🦊';
  return '🌐';
}

export function getChangeMethodColor(method?: string): { bg: string; text: string; border: string } {
  const m = (method || '').toLowerCase();
  if (m.includes('cell') || m.includes('writepad')) {
    return { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' };
  }
  if (m.includes('folder')) {
    return { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' };
  }
  if (m.includes('trash') || m.includes('delete')) {
    return { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' };
  }
  if (m.includes('create') || m.includes('import')) {
    return { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' };
  }
  return { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' };
}

