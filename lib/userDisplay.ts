export type DisplayUser = {
  email?: string | null;
  user_metadata?: {
    first_name?: string | null;
    given_name?: string | null;
    full_name?: string | null;
    name?: string | null;
  } | null;
};

function normalizeFirstName(value: string | null | undefined) {
  const first = String(value || "")
    .trim()
    .split(/[\s._+-]+/)[0] || "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function firstNameFromUser(user: DisplayUser | null | undefined) {
  const metadata = user?.user_metadata || {};
  return (
    normalizeFirstName(metadata.first_name) ||
    normalizeFirstName(metadata.given_name) ||
    normalizeFirstName(metadata.full_name) ||
    normalizeFirstName(metadata.name) ||
    normalizeFirstName(user?.email ? user.email.split("@")[0] : "")
  );
}
