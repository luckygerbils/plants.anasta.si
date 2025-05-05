export interface Plant {
  id: string,
  name: string,
  scientificName?: string,
  photos: { id: string, modifyDate: string }[],
  links: { site: string, url: string }[],
  location?: string,
  needsIdentification?: boolean,
  likelyDead?: boolean,
}