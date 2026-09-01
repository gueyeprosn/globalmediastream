export const escapeXml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const buildXmlFields = (fields: Array<{ name: string; value: string }>) => {
  const xmlFields = fields
    .map((f) => `<Field Name="${escapeXml(f.name)}">${escapeXml(f.value)}</Field>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><DataSource><Fields>${xmlFields}</Fields></DataSource>`;
};
