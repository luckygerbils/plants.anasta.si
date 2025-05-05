// Quick script to backfill photo sizes and modified dates
import { readdir, readFile, writeFile } from "fs/promises";
import { getExifModifyDate } from "./exif";
import { Page } from "../src/html";
import sharp from "sharp";
import { existsSync } from "fs";

type Plant = Parameters<typeof Page>[0]["plant"];

const plants = JSON.parse(await readFile("plants.json", "utf8")) as Plant[];
for (const plantId of await readdir("photos")) {
  for (const photoId of await readdir(`photos/${plantId}`)) {
    const plant = plants.find(({id}) => id === plantId);
    if (!plant) {
      console.log(`delete? ${plantId}`);
      continue;
    }

    const photos = plant.photos!.filter(({id}) => id === photoId);
    if (photos.length === 0) {
      console.log(`delete? photos/${plantId}/${photoId}`);
      continue;
    }
    if (photos.length > 1) {
      console.log(`duplicate? ${plantId}/${photoId}`);
      continue;
    }
    const photo = photos[0];

    const original = sharp(await readFile(`photos/${plantId}/${photoId}/original.jpg`));

    const metadata = await original.metadata();
    for (const size of ["progressive", 100, 250, 500, 1000] as const) {
      const filename = size === "progressive" ? "progressive.jpg" : `size-${size}.jpg`;
      if (existsSync(`photos/${plantId}/${photoId}/${filename}`)) {
        continue;
      }

      const resized = size === "progressive" 
        ? await original.jpeg({ progressive: true, }).toBuffer() 
        : await original.resize(size).toBuffer();
      await writeFile(`photos/${plantId}/${photoId}/${filename}`, resized);
      console.log(`created photos/${plantId}/${photoId}/${filename}`)
    }

    photo.modifyDate ??= (metadata.exif ? (await getExifModifyDate(metadata.exif))?.toISOString() : null) 
      ?? (() => { throw new Error(`No modified date for ${photoId}`)})();
  }
}

writeFile("plants.json", JSON.stringify(plants, null, "  "))
console.log("wrote plants.json");
