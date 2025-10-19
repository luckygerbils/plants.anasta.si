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

export type PhotoId = string;
export interface Photo { 
  id: PhotoId, 
  modifyDate: string,
  tags?: string[]
}

export interface JournalEntry {
  id: string,
  text?: string,
  date: string,
}
export type PartialJournalEntry = Omit<JournalEntry, "id">;

export interface Plant {
  id: string,
  name: string,
  scientificName?: string,
  description?: string,
  photos: Photo[],
  links: { site: string, url: string }[],
  tags: Partial<Record<TagKey, string>>,
  journal?: JournalEntry[],
}

export interface UploadPhotoInput {
  photo: { dataUrl: string } | { key: string },
  rotation: number,
  plantId: string,
}