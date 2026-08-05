// Génère un fichier .ics minimal (RFC 5545) pour un événement ponctuel,
// suffisant pour un "ajouter à mon agenda" dans Gmail/Outlook/Apple Calendar.

function toIcsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(s: string) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function buildVisitIcs(params: {
  uid: string;
  startsAt: string | Date;
  durationMinutes: number;
  summary: string;
  location?: string;
  description?: string;
}) {
  const start = typeof params.startsAt === "string" ? new Date(params.startsAt) : params.startsAt;
  const end = new Date(start.getTime() + params.durationMinutes * 60_000);
  const now = new Date();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//lokt.fr//Agenda de visite//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(params.summary)}`,
    params.location ? `LOCATION:${escapeIcsText(params.location)}` : null,
    params.description ? `DESCRIPTION:${escapeIcsText(params.description)}` : null,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((line): line is string => line !== null);

  // Les fins de ligne CRLF sont requises par la norme iCalendar.
  return lines.join("\r\n");
}
