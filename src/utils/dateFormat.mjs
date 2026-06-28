export function calculateBabyAge(dateOfBirth, now = new Date()) {
  const birth = new Date(`${dateOfBirth}T00:00:00+08:00`);
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  let anchor = new Date(birth);
  anchor.setMonth(anchor.getMonth() + months);

  if (anchor > now) {
    months -= 1;
    anchor = new Date(birth);
    anchor.setMonth(anchor.getMonth() + months);
  }

  const days = Math.max(0, Math.floor((startOfDay(now) - startOfDay(anchor)) / 86400000));
  const monthLabel = months === 1 ? "month" : "months";
  const dayLabel = days === 1 ? "day" : "days";

  return `${months} ${monthLabel} ${days} ${dayLabel}`;
}

export function calculateBabyAgeShort(dateOfBirth, atDate = new Date()) {
  const birth = new Date(`${dateOfBirth}T00:00:00+08:00`);
  const date = new Date(atDate);
  let months = (date.getFullYear() - birth.getFullYear()) * 12 + date.getMonth() - birth.getMonth();
  let anchor = new Date(birth);
  anchor.setMonth(anchor.getMonth() + months);

  if (anchor > date) {
    months -= 1;
    anchor = new Date(birth);
    anchor.setMonth(anchor.getMonth() + months);
  }

  const days = Math.max(0, Math.floor((startOfDay(date) - startOfDay(anchor)) / 86400000));

  if (months <= 0) return `${days} days old`;
  if (days === 0) return `${months} ${months === 1 ? "month" : "months"} old`;
  return `${months} ${months === 1 ? "month" : "months"}, ${days} ${days === 1 ? "day" : "days"} old`;
}

export function formatRelativeTime(dateTime, now = new Date()) {
  const diffMinutes = Math.max(0, Math.round((now - new Date(dateTime)) / 60000));

  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatDuration(totalMinutes) {
  const numericMinutes = Number(totalMinutes);
  if (Number.isFinite(numericMinutes) && numericMinutes > 0 && numericMinutes < 1) {
    return `${Math.max(1, Math.round(numericMinutes * 60))}s`;
  }
  totalMinutes = numericMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatDurationBetween(startedAt, endedAt) {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return "";

  const totalSeconds = Math.max(1, Math.round((end - start) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return seconds > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${hours}h ${minutes}m`;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function formatEventDate(dateTime, now = new Date()) {
  const eventDate = new Date(dateTime);
  const diffDays = Math.ceil((startOfDay(eventDate) - startOfDay(now)) / 86400000);
  const dateLabel = eventDate.toLocaleDateString("en-MY", { day: "numeric", month: "short" });

  if (diffDays === 0) return { dateLabel: "Today", relativeLabel: "today" };
  if (diffDays === 1) return { dateLabel: "Tomorrow", relativeLabel: "tomorrow" };
  return { dateLabel, relativeLabel: `in ${diffDays} days` };
}

export function formatTime(dateTime) {
  return new Date(dateTime).toLocaleTimeString("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

export function isSameLocalDay(dateTime, now = new Date()) {
  return startOfDay(new Date(dateTime)).getTime() === startOfDay(now).getTime();
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
