import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { renderToString } from "react-dom/server";
import React from "react";

import { Page } from "./src/page";

type Plant = Parameters<typeof Page>[0]["plant"];

const plants = JSON.parse(await readFile("plants.json", "utf8"));

await mkdir(`dist`);

const results = await Promise.all([
  copyFile("src/page.css", "dist/page.css").then(() => `Copied src/page.css`),
  ...plants.map(async (plant: Plant, i: number) => 
    {
      try {
        await mkdir(`dist/${plant.id}`, { recursive: true });
        await writeFile(
          `dist/${plant.id}/index.html`,
          "<!DOCTYPE html>\n" + renderToString(React.createElement(Page, { plant, prev: plants[i - 1]?.id, next: plants[i +1 ]?.id }))
        );
        return `Built ${plant.id}: ${plant.name}`
      } catch (e) {
        return `Error ${plant.id}: ${e}`
      }
    })
])

for (const result of results) {
  console.log(result);
}