import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { renderToString } from "react-dom/server";

import { comparing, localeCompare, nullsFirst } from "../src/sorting";
import { Plant } from "../src/plant";
import { PublicPlantPage } from "../src/public-plant-page";
import { PropsWithChildren } from "react";
import { PublicIndexPage } from "../src/public-index-page";

const plants = (JSON.parse(await readFile("plants.json", "utf8")) as Plant[])
  .filter(p => p.tags.find(t => t.key === "public" && t.value === "true"))
  .sort(comparing(p => p.location, nullsFirst(localeCompare)));

await mkdir(`dist`, { recursive: true });

interface HtmlProps {
  title: string;
}

function Html({ title, children }: PropsWithChildren<HtmlProps>) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content" />
        <meta name="theme-color" content="#223225"/>
        <link rel="icon" href="images/favicon.svg" sizes="any" type="image/svg+xml" />
        <title>{title}</title>
        <link rel="stylesheet" href="/page.css" />
      </head>
      <body>  
        <main>{children}</main>
      </body>
    </html>
  );
}

const results = await Promise.all([
  copyFile("src/page.css", "dist/page.css").then(() => `Copied src/page.css`),
  await writeFile(
    `dist/index.html`,
    "<!DOCTYPE html>\n" + renderToString(
      <Html title="All Plants">
        <PublicIndexPage allPlants={plants} />
      </Html>
    )
  ).then(() => `Built index.html`),
  Promise.all(
    plants.map(async (plant: Plant, i: number) => 
      {
        try {
          await mkdir(`dist/${plant.id}`, { recursive: true });
          await writeFile(
            `dist/${plant.id}/index.html`,
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
      `Built: ${results.filter(({ error }) => error == null).length}`, 
      `Errors: ${results.filter(({ error }) => error != null).length}`
    ])
])

for (const result of results.flat()) {
  console.log(result);
}