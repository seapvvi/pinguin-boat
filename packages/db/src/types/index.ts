export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedData {
  title?: string;
  description?: string;
  color: string;
  fields: EmbedField[];
  footer?: string;
  image?: string;
  thumbnail?: string;
  authorName?: string;
  authorIcon?: string;
  timestamp: boolean;
}

export interface EmbedVariable {
  key: string;
  label: string;
  example: string;
}

export function parseEmbedFields(value: string | null | undefined): EmbedField[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as EmbedField[] : [];
  } catch {
    return [];
  }
}

export function serializeEmbedFields(fields: EmbedField[]): string {
  return JSON.stringify(fields);
}
