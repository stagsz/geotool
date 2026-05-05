import { ContentTree } from "./html-parser";

export type EntityType = "brand" | "product" | "location" | "category";

export interface Entity {
  type: EntityType;
  value: string;
  confidence: number;
}

export function extractEntities(tree: ContentTree): Entity[] {
  const entities: Entity[] = [];

  const brand = extractBrandFromTitle(tree.title);
  if (brand) {
    entities.push({ type: "brand", value: brand, confidence: 0.9 });
  }

  const locations = extractLocations(tree.rawHtml);
  for (const loc of locations) {
    entities.push({ type: "location", value: loc, confidence: 0.7 });
  }

  return entities;
}

function extractBrandFromTitle(title: string): string | null {
  const parts = title.split(/\s*[-|]\s*/);
  if (parts.length > 1) return parts[parts.length - 1].trim();
  return title.length > 0 ? title.trim() : null;
}

function extractLocations(html: string): string[] {
  const re = /(?:in|at|from|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    seen.add(m[1]);
    if (seen.size >= 10) break;
  }
  return Array.from(seen);
}

