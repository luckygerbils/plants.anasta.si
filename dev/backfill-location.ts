// Quick script to backfill photo sizes and modified dates
import { readFile, writeFile } from "fs/promises";
import { Page } from "../src/html";
import { createInterface } from "node:readline/promises";

type Plant = Parameters<typeof Page>[0]["plant"];

const rl = createInterface({ input: process.stdin, output: process.stdout, });

const plants = JSON.parse(await readFile("plants.json", "utf8")) as Plant[];
const locations: string[] = [];
for (const plant of plants) {
  if (plant.location == null) {
    const locationInput = await rl.question(`Where is ${plant.name}? `);
    const matchedLocations = locations.filter(l => l.match(new RegExp(locationInput, "i")));
    if (matchedLocations.length === 1) {
      plant.location = matchedLocations[0];
    } else if (matchedLocations.length > 1) {
      matchedLocations.forEach((matchedLocation, i) => {
        console.log(`${i}: ${matchedLocation}`);
      });
      const index = await rl.question(`Clarify which #? `);
      plant.location = matchedLocations[parseInt(index)];
    } else {
      locations.push(locationInput);
      plant.location = locationInput;
    }
    console.log(`Added to ${plant.location}`);
  }
}
rl.close();

writeFile("plants.json", JSON.stringify(plants, null, "  "))
console.log("wrote plants.json");
