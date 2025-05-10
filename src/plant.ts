export type IdConfidence = "high" | "medium" | "low";

export const TAG_KEYS = [
  "location", 
  "planted", 
  "confidence", 
  "public",
  "bonsai", 
  "needsIdentification", 
  "likelyDead",
] as const;
export type TagKey = typeof TAG_KEYS[number];

export interface Tag {
  key: TagKey,
  value?: string,
}

export interface Plant {
  id: string,
  name: string,
  scientificName?: string,
  photos: { id: string, modifyDate: string }[],
  links: { site: string, url: string }[],
  location?: string,
  needsIdentification?: boolean,
  likelyDead?: boolean,
  plantedDate?: string,
  idConfidence?: IdConfidence,
  tags: Partial<Record<TagKey, string>>,
}