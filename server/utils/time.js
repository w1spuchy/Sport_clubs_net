export function timeToSeconds(t) {
  const parts = String(t).split(":").map((x) => parseInt(x, 10));
  if (parts.length === 2) {
    const [hh, mm] = parts;
    return hh * 3600 + mm * 60;
  }
  if (parts.length === 3) {
    const [hh, mm, ss] = parts;
    return hh * 3600 + mm * 60 + ss;
  }
  throw new Error(`Invalid time: ${t}`);
}

export function dateToSecondsOfDay(d) {
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

export function isClubOpenNow(openingTime, closingTime) {
  const now = new Date();
  const nowSec = dateToSecondsOfDay(now);
  const openSec = timeToSeconds(openingTime);
  const closeSec = timeToSeconds(closingTime);
  return nowSec >= openSec && nowSec < closeSec; 
}

export function minutesToSeconds(min) {
  const n = Number(min);
  if (n <= 0) throw new Error("Invalid minutes");
  return Math.floor(n * 60);
}

export function isDateWithinWorkingHours(startDate, durationSec, openingTime, closingTime) {
  const startSec = dateToSecondsOfDay(startDate);
  const endSec = startSec + durationSec;

  const openSec = timeToSeconds(openingTime);
  const closeSec = timeToSeconds(closingTime);

  return startSec >= openSec && endSec <= closeSec;
}