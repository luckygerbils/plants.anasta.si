import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { renderToString } from "react-dom/server";

import { comparing, localeCompare, nullsFirst } from "../src/sorting";
import { Plant } from "../src/plant";
import { PublicPlantPage } from "../src/public-plant-page";
import { PropsWithChildren } from "react";
import { PublicIndexPage } from "../src/public-index-page";

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

interface HtmlProps {
  title: string;
  className?: string;
}

function Html({ title, children, className }: PropsWithChildren<HtmlProps>) {
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
        <main className={className}>{children}</main>
        <script>{`
          if (Object.fromEntries(document.cookie.split(";").map(c => c.split("=").map(s => s.trim())))["editor"] === "true"){
            document.body.classList.add("editor");
           }
        `}</script>
      </body>
    </html>
  );
}

const results = await Promise.all([
  copyFile("src/page.css", "dist/page.css").then(() => `Copied src/page.css`),
  await writeFile(
    `dist/index.html`,
    "<!DOCTYPE html>\n" + renderToString(
      <Html title="All Plants" className="index">
        <PublicIndexPage allPlants={publicPlants} />
      </Html>
    )
  ).then(() => `Built index.html`),
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