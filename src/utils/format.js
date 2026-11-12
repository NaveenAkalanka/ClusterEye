// Decimal (SI) units so the same dataset shows the same numbers on every page.
export function fmtBytes(bytes) {
  const b = Math.max(0, Number(bytes || 0));
  const GB = 1_000_000_000;
  const TB = 1_000_000_000_000;
  if (b === 0) return "0 GB";
  if (b < GB) return `${(b / 1_000_000).toFixed(0)} MB`;
  if (b < 1000 * GB) return `${(b / GB).toFixed(b % GB === 0 ? 0 : 1)} GB`;
  return `${(b / TB).toFixed(1)} TB`;
}

// Natural ordering keeps IPs and numeric IDs in number order: .9 before .20 before .100.
export function naturalCompare(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
}

export function sortRecords(records, { key, direction }, getValue = (record, field) => record[field]) {
  if (!key) return records;
  const order = direction === "asc" ? 1 : -1;
  return [...records].sort((a, b) => naturalCompare(getValue(a, key), getValue(b, key)) * order);
}

// Opens a record from anywhere on its row, without firing when text is selected to copy it.
export function openOnRowClick(open) {
  return () => {
    if (!window.getSelection()?.toString()) open();
  };
}

export function toHref(link) {
  return /^https?:\/\//i.test(link) ? link : `http://${link}`;
}

export function authErrorMessage(error, fallback) {
  switch (error?.code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/user-not-found":
      return "That email and password don't match. Check them and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes, then try again.";
    case "auth/network-request-failed":
      return "Could not reach the sign-in service. Check your connection and try again.";
    case "auth/email-already-in-use":
      return "That email is already in use. Log in instead, or use a different email.";
    case "auth/invalid-email":
      return "That email address isn't valid.";
    case "auth/weak-password":
      return "Choose a stronger password with at least 6 characters.";
    case "auth/requires-recent-login":
      return "For your security, log out and back in, then try again.";
    default:
      return fallback;
  }
}

/** Colour for a cluster with none saved, and the preset for a new cluster. */
export const DEFAULT_CLUSTER_COLOR = "#22C55E";

/** A loose email shape check; Firebase does the real validation. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
