export type IdConfidence = "high" | "medium" | "low";

export const TAG_KEYS = [
  "location", 
  "planted", 
  "confidence", 
  "public",
  "bonsai", 
  "needsIdentification", 
  "needsLabel",
  "likelyDead",
] as const;
export type TagKey = typeof TAG_KEYS[number];

export interface Tag {
  key: TagKey,
  value?: string,
}

export interface Photo { 
  id: string, 
  modifyDate: string 
}

export interface Plant {
  id: string,
  name: string,
  scientificName?: string,
  photos: Photo[],
  links: { site: string, url: string }[],
  tags: Partial<Record<TagKey, string>>,
}