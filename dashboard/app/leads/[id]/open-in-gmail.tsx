"use client";

export function OpenInGmail({
  body,
  to,
  businessName,
}: {
  body: string;
  to: string | null;
  businessName: string;
}) {
  const subject = `${businessName} — quelques observations`;
  const url =
    "https://mail.google.com/mail/?view=cm&fs=1" +
    (to ? `&to=${encodeURIComponent(to)}` : "") +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-xs px-2 py-1 rounded bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 inline-flex items-center gap-1"
    >
      ✉️ Ouvrir dans Gmail
    </a>
  );
}
