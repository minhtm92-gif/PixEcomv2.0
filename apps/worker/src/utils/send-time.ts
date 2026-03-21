/**
 * Send Time Optimization Utility
 *
 * Determines the optimal send time for lifecycle emails based on
 * the recipient's timezone. Targets 9:00 AM local time for best
 * open rates among senior demographics.
 *
 * Rules:
 *   - If current local time is 8 AM - 4 PM  -> send immediately
 *   - If current local time is 4 PM - 8 AM  -> delay until next day 9 AM
 *   - Default timezone: America/New_York (most US seniors)
 */

/**
 * Returns the optimal send time for a lifecycle email.
 *
 * @param timezone  IANA timezone string (e.g. "America/New_York"), or null
 * @param now       Current UTC time
 * @returns         A Date representing when the email should be sent
 */
export function getOptimalSendTime(
  timezone: string | null,
  now: Date,
): Date {
  const tz = timezone || 'America/New_York';

  // Get the current hour in the recipient's timezone
  let localHour: number;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((p) => p.type === 'hour');
    localHour = hourPart ? parseInt(hourPart.value, 10) : 9;
  } catch {
    // Invalid timezone — fall back to sending now
    return now;
  }

  // 8 AM - 4 PM local -> send now
  if (localHour >= 8 && localHour < 16) {
    return now;
  }

  // Outside 8-16 window -> schedule for next day 9 AM local time
  // Calculate the offset: find what UTC time corresponds to 9 AM in the target timezone

  // Get today's date string in the target timezone
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localDateStr = dateFormatter.format(now); // "YYYY-MM-DD"

  // If it's past 4 PM, we need tomorrow at 9 AM; if it's before 8 AM, we need today at 9 AM
  const localDate = new Date(`${localDateStr}T09:00:00`);

  // Calculate the timezone offset by comparing a known local time to UTC
  const utcFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const localFullFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Parse both representations of 'now' to find the offset
  const utcParts = utcFormatter.format(now).replace(',', '');
  const localParts = localFullFormatter.format(now).replace(',', '');

  const utcMs = new Date(utcParts + ' UTC').getTime();
  const localMs = new Date(localParts + ' UTC').getTime();
  const offsetMs = localMs - utcMs; // positive if ahead of UTC

  // Build target: 9 AM local, converted to UTC
  // Start with today's local date
  const targetLocalStr = localHour >= 16
    ? // After 4 PM — target tomorrow 9 AM
      addDays(localDateStr, 1) + 'T09:00:00'
    : // Before 8 AM — target today 9 AM
      localDateStr + 'T09:00:00';

  // Parse as if UTC, then subtract the offset to get actual UTC
  const targetUtcMs = new Date(targetLocalStr + 'Z').getTime() - offsetMs;
  const targetDate = new Date(targetUtcMs);

  // Safety: if the target is somehow in the past, send now
  if (targetDate.getTime() <= now.getTime()) {
    return now;
  }

  return targetDate;
}

/**
 * Add days to a YYYY-MM-DD string.
 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
