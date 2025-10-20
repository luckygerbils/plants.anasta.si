import { mkdir, readFile, writeFile, copyFile, stat, readdir } from "node:fs/promises";
import { renderToString } from "react-dom/server";

import { comparing, localeCompare, nullsFirst } from "../src/util/sorting";
import { Plant } from "../src/model/plant";
import { PublicPlantPage } from "../src/public-plant-page";
import { PublicIndexPage } from "../src/public-index-page";
import { Html } from "../src/html";
import { AdminPlantPage } from "../src/admin-plant-page";
import { build } from "esbuild";
import { LoginPage } from "../src/login-page";
import { basename, dirname, extname, normalize, relative } from "node:path";
import { createHash } from "node:crypto";
import { ReactNode } from "react";
import { AdminIndexPage } from "../src/admin-index-page";
import { webmanifest } from "../src/webmanifest";

const plantsFile = process.argv[2];
if (plantsFile == null) {
  throw new Error("plants file is required");
}

const srcDir = `src`;
const instance = basename(plantsFile, ".json");
const outputDir = `dist/website/${instance}`

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
  const hash = createHash('md5').update(out.contents).digest('hex').substring(0, 8);
  const hashedPath = `${base}.${hash}${extension}`;
  assetHashes[outfile] = hashedPath;
  const outputPath = `${outputDir}/${hashedPath}`;
  await mkdir(dirname(outputPath), { recursive: true });
  return writeFile(outputPath, out.contents)
    .then(() => `Bundled ${entryPoint} to ${outputPath}`)
}

async function render(outfile: string, htmlProps: Omit<Parameters<typeof Html>[0], "children"|"assetHashes">, page: ReactNode) {
  const outputPath = `${outputDir}/${outfile}`;
  await mkdir(dirname(outputPath), { recursive: true });
  return writeFile(
    outputPath,
    "<!DOCTYPE html>\n" + renderToString(
      <Html {...htmlProps} assetHashes={assetHashes}>
        {page}
      </Html>
    )
  ).then(() => `Built ${outfile}`)
}

async function generateWebmanifest() {
  const contents = JSON.stringify(webmanifest(instance, assetHashes), null, "  ");

  const outfile = "webmanifest.json";
  const extension = extname(outfile);
  const base = basename(outfile, extension);
  const hash = createHash('md5').update(contents).digest('hex').substring(0, 8);
  const hashedPath = `${base}.${hash}${extension}`;
  assetHashes[outfile] = hashedPath;
  const outputPath = `${outputDir}/${hashedPath}`;

  await mkdir(dirname(outputPath), { recursive: true });
  return writeFile(
    outputPath,
    contents
  ).then(() => `Generated webmanifest.json`)
}

const staticFilesWithHashes = Promise.all(
  [ `${srcDir}/images` ]
    .map(path => copy(srcDir, path, { hash: true }))
);

const webmanifestFile = staticFilesWithHashes
  .then(() => generateWebmanifest());

const staticFilesWithoutHashes = Promise.all(
  [ `${srcDir}/favicon.ico` ]
    .map(path => copy(srcDir, path))
)

const scriptEntryPoints = Promise.all(
  [
    [`${srcDir}/admin-index-page-script.ts`, `js/admin/index.js`],
    [`${srcDir}/admin-plant-page-script.ts`, `js/admin/plant.js`],
    [`${srcDir}/login-page-script.ts`, `js/login.js`]
  ].map(([ entryPoint, outfile ]) => bundle(entryPoint, outfile))
);

const cssFiles = Promise.all(
  [
    [`${srcDir}/admin-index-page.css`, `css/admin/index.css`],
    [`${srcDir}/admin-plant-page.css`, `css/admin/plant.css`],
    [`${srcDir}/login-page.css`, `css/login.css`],
    [`${srcDir}/public-index-page.css`, `css/index.css`],
    [`${srcDir}/public-plant-page.css`, `css/plant.css`]
  ].map(([ cssFile, outfile ]) => bundle(cssFile, outfile))
);

const htmlFiles = Promise.all([staticFilesWithHashes, scriptEntryPoints, cssFiles])
.then(() => Promise.all([
  render("index.html", { title: "All Plants", css: "css/index.css" }, <PublicIndexPage allPlants={publicPlants} />),
  render("admin/list", { title: "Admin", script: `js/admin/index.js`, css: "css/admin/index.css", props: {}}, <AdminIndexPage />),
  render("admin/plant", { title: "Edit", script: `js/admin/plant.js`, css: "css/admin/plant.css", props: {}}, <AdminPlantPage />),
  render("login", { title: "Login", script: `js/login.js`, css: "css/login.css", props: {}}, <LoginPage />),
  Promise.all(
    plants
      .sort(comparing(p => p.tags.location, nullsFirst(localeCompare)))
      .map(async (plant: Plant, i: number) => 
      {
        try {
          render(plant.id, { title: plant.name, css: "css/plant.css" }, <PublicPlantPage plant={plant} allPlants={plants} prev={plants[i-1]?.id} next={plants[i+1]?.id} />);
          return { plant };
        } catch (e) {
          return { error: e as Error, plant };
        }
      })
  ).then(results => [
    `Plants: ${results.filter(({ error }) => error == null).length}`, 
    `Errors: ${results.filter(({ error }) => error != null).length}`
  ]),
]));

const tasks = [
  staticFilesWithHashes.then(result => result.join("\n")),
  webmanifestFile,
  staticFilesWithoutHashes.then(result => result.join("\n")),
  scriptEntryPoints.then(result => result.join("\n")),
  cssFiles.then(result => result.join("\n")),
  htmlFiles.then(result => result.join("\n")),
].flat();

for (const result of await Promise.all(tasks)) {
  console.log(result);
}