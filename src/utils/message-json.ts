export function fieldsToObject(fields: Array<{ name: string; value: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) out[f.name] = f.value;
  return out;
}

export function buildJsonFromFields(fields: Array<{ name: string; value: string }>): string {
  return JSON.stringify(fieldsToObject(fields), null, 2);
}

export function buildJsonFromObject(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2);
}
