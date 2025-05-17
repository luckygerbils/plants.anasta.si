import { mkdir, readFile, writeFile, copyFile, stat, glob, cp, readdir } from "node:fs/promises";
import { renderToString } from "react-dom/server";

import { comparing, localeCompare, nullsFirst } from "../src/util/sorting";
import { Plant } from "../src/model/plant";
import { PublicPlantPage } from "../src/public-plant-page";
import { PublicIndexPage } from "../src/public-index-page";
import { Html } from "../src/html";
import { EditPlantPage } from "../src/edit-page";
import { build } from "esbuild";
import { LoginPage } from "../src/login-page";
import { basename, dirname, extname, normalize, relative, resolve } from "node:path";
import { createHash } from "node:crypto";

const plantsFile = process.argv[2];
if (plantsFile == null) {
  throw new Error("plants file is required");
}

const srcDir = `src`;
const outputDir = `dist/website/${basename(plantsFile, ".json")}`

const plants = (JSON.parse(await readFile(plantsFile, "utf8")) as Plant[]);
const [ publicPlants, privatePlants ] = plants.reduce((result: [Plant[], Plant[]], plant) => {
  if (plant.tags.public === "true" && plant.tags.likelyDead !== "true") {
    result[0].push(plant);
  } else {
    result[1].push(plant);
  }
  return result;
}, [[], []]); 

await mkdir(outputDir, { recursive: true });
await mkdir(`${outputDir}/css`, { recursive: true });
await mkdir(`${outputDir}/images`, { recursive: true });

const assetHashes: Record<string, string> = {};
async function copy(srcDir: string, path: string, options?: { hash?: boolean }): Promise<string> {
  if ((await stat(path)).isDirectory()) {
    return Promise.all(
      (await readdir(path)).map(entry => copy(srcDir, `${path}/${entry}`, options))
    ).then(results => results.join("\n"));
  } else {
    const relativePath = relative(srcDir, path);
    let outputPath;
    if (options?.hash) {
      const extension = extname(path);
      const base = basename(relativePath, extension);
      const dir = dirname(relativePath);
      const hash = createHash('md5').update(await readFile(path)).digest('hex').substring(0, 8);
      const hashedPath = `${dir}/${base}.${hash}${extension}`;
      assetHashes[relativePath] = hashedPath;
      outputPath = normalize(`${outputDir}/${hashedPath}`);
    } else {
      outputPath = `${outputDir}/${relativePath}`;
    }
    await mkdir(dirname(outputPath), { recursive: true });
    return copyFile(path, outputPath)
      .then(() => `Copied ${path} to ${outputPath}`)
  }
}

async function bundle(entryPoint: string, outfile: string) {
  const result = await build({
    entryPoints: [ entryPoint ],
    bundle: true,
    logLevel: "info",
    write: false,
  });
  const [ out ] = result.outputFiles;
  const extension = extname(outfile);
  const base = basename(outfile, extension);
  const hashedPath = `${base}.${out.hash}${extension}`;
  assetHashes[outfile] = hashedPath;
  const outputPath = `${outputDir}/${hashedPath}`;
  await mkdir(dirname(outputPath), { recursive: true });
  return writeFile(outputPath, out.contents)
    .then(() => `Bundled ${entryPoint} to ${outputPath}`)
}

const staticFilesWithHashes = Promise.all(
  [ `${srcDir}/page.css`, `${srcDir}/images`, ]
    .map(path => copy(srcDir, path, { hash: true }))
);

const staticFilesWithoutHashes = Promise.all(
  [ `${srcDir}/favicon.ico` ]
    .map(path => copy(srcDir, path))
)

const scriptEntryPoints = Promise.all(
  [
    [`${srcDir}/edit-page-script.ts`, `js/edit.js`],
    [`${srcDir}/login-page-script.ts`, `js/login.js`]
  ].map(([ entryPoint, outfile ]) => bundle(entryPoint, outfile))
);

const htmlFiles = Promise.all([staticFilesWithHashes, scriptEntryPoints]).then(() => Promise.all([
  writeFile(
    `${outputDir}/index.html`,
    "<!DOCTYPE html>\n" + renderToString(
      <Html title="All Plants" className="index" assetHashes={assetHashes}>
          <PublicIndexPage allPlants={publicPlants} />
        </Html>
    )
  ).then(() => `Built index.html`),
  writeFile(
    `${outputDir}/edit`,
    "<!DOCTYPE html>\n" + renderToString(
      <Html className="edit" title="Edit" script="js/edit.js" props={{}} assetHashes={assetHashes}>
        <EditPlantPage />
      </Html>
    )
  ).then(() => `Built edit`),
  writeFile(
    `${outputDir}/login`,
    "<!DOCTYPE html>\n" + renderToString(
      <Html className="login" title="Login" script="js/login.js" props={{}} assetHashes={assetHashes}>
        <LoginPage />
      </Html>
    )
  ).then(() => `Built login`),
  Promise.all(
    plants
      .sort(comparing(p => p.tags.location, nullsFirst(localeCompare)))
      .map(async (plant: Plant, i: number) => 
      {
        try {
          await writeFile(
            `${outputDir}/${plant.id}`,
            "<!DOCTYPE html>\n" + renderToString(
              <Html title={plant.name} assetHashes={assetHashes}>
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
]))

const tasks = [
  staticFilesWithHashes.then(result => result.join("\n")),
  staticFilesWithoutHashes.then(result => result.join("\n")),
  scriptEntryPoints.then(result => result.join("\n")),
  htmlFiles
].flat();

for (const result of await Promise.all(tasks)) {
  console.log(result);
}