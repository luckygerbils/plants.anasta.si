import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { renderToString } from "react-dom/server";

import { comparing, localeCompare, nullsFirst } from "../src/sorting";
import { Plant } from "../src/plant";
import { PublicPlantPage } from "../src/public-plant-page";
import { PropsWithChildren } from "react";
import { PublicIndexPage } from "../src/public-index-page";
import { Html } from "../src/html";
import { EditPlantPage } from "../src/plant-page";
import { build } from "esbuild";

const plants = (JSON.parse(await readFile("plants.json", "utf8")) as Plant[]);
const [ publicPlants, privatePlants ] = plants.reduce((result: [Plant[], Plant[]], plant) => {
  if (plant.tags.public === "true" && plant.tags.likelyDead !== "true") {
    result[0].push(plant);
  } else {
    result[1].push(plant);
  }
  return result;
}, [[], []]); 

await mkdir(`dist`, { recursive: true });

const results = await Promise.all([
  copyFile("src/page.css", "dist/page.css").then(() => `Copied src/page.css`),
  build({
    entryPoints: [ 'src/page.ts' ],
    bundle: true,
    outfile: 'dist/page.js',
    logLevel: "info",
  }),
  writeFile(
    `dist/index.html`,
    "<!DOCTYPE html>\n" + renderToString(
      <Html title="All Plants" className="index">
        <PublicIndexPage allPlants={publicPlants} />
      </Html>
    )
  ).then(() => `Built index.html`),
  writeFile(
    `dist/edit`,
    "<!DOCTYPE html>\n" + renderToString(
      <Html title="Edit" script="/page.js" props={{}}>
        <EditPlantPage />
      </Html>
    )
  ).then(() => `Built edit`),
  Promise.all(
    plants
      .sort(comparing(p => p.tags.location, nullsFirst(localeCompare)))
      .map(async (plant: Plant, i: number) => 
      {
        try {
          await writeFile(
            `dist/${plant.id}`,
            "<!DOCTYPE html>\n" + renderToString(
              <Html title={plant.name}>
                <PublicPlantPage plant={plant} allPlants={plants} prev={plants[i-1]?.id} next={plants[i+1]?.id} />
              </Html>
            )
          );
          return { plant };
        } catch (e) {
          return { error: e as Error, plant };
        }
      })
    ).then(results => [
      `Plants: ${results.filter(({ error }) => error == null).length}`, 
      `Errors: ${results.filter(({ error }) => error != null).length}`
    ]),
])

for (const result of results.flat()) {
  console.log(result);
}