import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { renderToString } from "react-dom/server";

import { comparing, localeCompare, nullsFirst } from "../src/sorting";
import { Plant } from "../src/plant";
import { PublicPlantPage } from "../src/public-plant-page";
import { PublicIndexPage } from "../src/public-index-page";
import { Html } from "../src/html";
import { EditPlantPage } from "../src/edit-page";
import { build } from "esbuild";
import { LoginPage } from "../src/login-page";

const plants = (JSON.parse(await readFile("plants.json", "utf8")) as Plant[]);
const [ publicPlants, privatePlants ] = plants.reduce((result: [Plant[], Plant[]], plant) => {
  if (plant.tags.public === "true" && plant.tags.likelyDead !== "true") {
    result[0].push(plant);
  } else {
    result[1].push(plant);
  }
  return result;
}, [[], []]); 

await mkdir(`dist/website`, { recursive: true });

const results = await Promise.all([
  copyFile("src/page.css", "dist/website/page.css").then(() => `Copied src/page.css`),
  Promise.all(
    [
      ["src/edit-page-script.ts", "dist/website/js/edit.js"],
      ["src/login-page-script.ts", "dist/website/js/login.js"]
    ].map(([ entryPoint, outfile ]) => build({
      entryPoints: [ entryPoint ],
      bundle: true,
      outfile: outfile,
      logLevel: "info",
    })),
  ),
  writeFile(
    `dist/website/index.html`,
    "<!DOCTYPE html>\n" + renderToString(
      <Html title="All Plants" className="index">
        <PublicIndexPage allPlants={publicPlants} />
      </Html>
    )
  ).then(() => `Built index.html`),
  writeFile(
    `dist/website/edit`,
    "<!DOCTYPE html>\n" + renderToString(
      <Html className="edit" title="Edit" script="/js/edit.js" props={{}}>
        <EditPlantPage />
      </Html>
    )
  ).then(() => `Built edit`),
  writeFile(
    `dist/website/login`,
    "<!DOCTYPE html>\n" + renderToString(
      <Html className="login" title="Login" script="/js/login.js" props={{}}>
        <LoginPage />
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
            `dist/website/${plant.id}`,
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