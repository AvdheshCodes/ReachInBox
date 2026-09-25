export function parseEmailsFromFileContent(content: string): string[] {
  if (!content) return [];

  // Match email regex
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = content.match(emailRegex) || [];

  // Deduplicate emails and clean strings
  const uniqueEmails = Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));

  return uniqueEmails;
}
