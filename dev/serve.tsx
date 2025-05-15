/**
 * A server for local testing and uploading
 */

import https from "node:https";
import http from "node:http";
import process from "node:process";
import sharp from "sharp";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { renderToString } from "react-dom/server";
import { build } from 'esbuild'

import { getExifModifyDate } from "../src/lambda/exif";
import { comparing, nullsFirst, localeCompare } from "../src/sorting";
import { EditPlantPage } from "../src/plant-page";
import { Plant } from "../src/plant";
import { PublicPlantPage } from "../src/public-plant-page";
import { Html } from "../src/html";
import { execSync } from "node:child_process";

await build({
  entryPoints: [ 'src/page.ts' ],
  bundle: true,
  outfile: 'dist/page.js',
  logLevel: "info",
});

const options = Object.fromEntries(process.argv.slice(2).map(arg => arg.split("=")) as [string, string][])

const plants = (JSON.parse(await readFile("plants.json", "utf8")) as Plant[])
  .sort(comparing(p => p.location, nullsFirst(localeCompare)));

const [ key, cert ] = await Promise.all([
  readFile(options["--key"]), 
  readFile(options["--cert"])
]);

function getResourceId(type: string, logicalResourceId: string) {
  return execSync(`aws --region us-west-2 --profile AdministratorAccess \
    cloudformation describe-stack-resources \
    --stack-name Beta-Plants-PrimaryStack \
    --query "StackResources[?ResourceType=='${type}' && starts_with(LogicalResourceId, '${logicalResourceId}')].PhysicalResourceId | [0]" \
    --output text`, { encoding: "utf8" }).trim()
}

function getFunctionUrl(functionName: string) {
  return execSync(`aws --region us-west-2 --profile AdministratorAccess \
    lambda get-function-url-config \
    --function-name "${functionName}" \
    --query "FunctionUrl" \
    --output text`, { encoding: "utf8" }).trim()
}

const region = "us-west-2";
const userPoolClientId = getResourceId("AWS::Cognito::UserPoolClient", "EditorUserPoolClient");
const userPoolId = getResourceId("AWS::Cognito::UserPool", "EditorUserPool");
const identityPoolId = getResourceId("AWS::Cognito::IdentityPool", "EditorIdentityPool");
const apiUrl = getFunctionUrl(getResourceId("AWS::Lambda::Function", "ApiFunction"));

const server = https.createServer({ key, cert, }, async (req, res) => {
  const url = req.url ?? "/";

  try {
    const patterns = [
      {
        pattern: /^(?<id>[a-z0-9]{8})$/,
        handler: async (match: RegExpMatchArray) => {
          const plantIndex = plants.findIndex(({id}) => match.groups!["id"] === id);
          const plant = plants[plantIndex];
          const props = { plant, allPlants: plants, prev: plants[plantIndex-1]?.id, next: plants[plantIndex+1]?.id };
          return { 
            status: 200, 
            body: "<!DOCTYPE html>\n" + renderToString(
                <Html title={plant.name}>
                  <PublicPlantPage {...props} />
                </Html>
              ),
            headers: {
              "content-type": "text/html",
            }
          };
        }
      },
      {
        pattern: /^edit/,
        handler: async (_: unknown, url: URL) => {
          return { 
            status: 200, 
            body: "<!DOCTYPE html>\n" + renderToString(
                <Html title="Edit" script="/page.js" props={{ userPoolClientId, userPoolId, identityPoolId, apiUrl, region }}>
                  <EditPlantPage />
                </Html>
              ),
            headers: {
              "content-type": "text/html",
            }
          };
        }
      },
      {
        pattern: /^api\/getPlant$/,
        handler: async () => {
          const { plantId } = JSON.parse(await getBody(req));
          const plantIndex = plants.findIndex(({id}) => plantId === id);
          const plant = plants[plantIndex];
          return {
            status: 200,
            body: JSON.stringify({ 
              plantId,
              plant, 
              prev: plants[plantIndex-1]?.id, 
              next: plants[plantIndex+1]?.id
            }),
            headers: {
              "content-type": "application/json"
            }
          };
        },
      },
      {
        pattern: /^api\/putPlant$/,
        handler: async () => {
          const { plant }: { plant: Plant } = JSON.parse(await getBody(req));
          const existingPlant = plants.find(({id}) => id === plant.id);
          if (existingPlant != null) {
            Object.assign(existingPlant, plant);
          } else {
            plants.push(plant);
          }
          await writeFile("plants.json", JSON.stringify(plants, null, "  "));
          console.log(`Saved ${JSON.stringify(plant)}`);
          return {
            status: 200,
            body: JSON.stringify({}),
            headers: {
              "content-type": "application/json"
            }
          }
        }
      },
      {
        pattern: /^api\/deletePlant$/,
        handler: async () => {
          const { plantId }: { plantId: string } = JSON.parse(await getBody(req));
          const plantIndex = plants.findIndex(({id}) => id === plantId);
          const deletedPlant = plants.splice(plantIndex, 1);
          await writeFile("plants.json", JSON.stringify(plants, null, "  "));
          console.log(`Deleted ${JSON.stringify(deletedPlant)}`);
          return {
            status: 200,
            body: JSON.stringify({}),
            headers: {
              "content-type": "application/json"
            }
          }
        }
      },
      {
        pattern: /^api\/uploadPhoto$/,
        handler: async () => {
          const {
            photo: {
              dataUrl,
            },
            rotation,
            plantId,
          } = JSON.parse(await getBody(req));

          const dataUrlWithoutPrefix =
          dataUrl.substring(dataUrl.indexOf(";base64,") + ";base64,".length);
          const original = sharp(Buffer.from(dataUrlWithoutPrefix, "base64"));

          const metadata = await original.metadata();
          if (!(metadata.format === "jpeg" || metadata.format === "jpg")) {
            throw new Error(`Format ${metadata.format} unsupported. JPEG only for now`);
          }

          // Initial rotate to match Exif orientation data
          const exifRotated = sharp(await original.rotate().toBuffer());

          const rotated = rotation ? exifRotated.rotate(rotation) : exifRotated;

          const [
            rotatedOriginal,
            progressive,
            size100,
            size250,
            size500,
            size1000,
          ] = await Promise.all([
            rotated.toBuffer(),
            rotated.jpeg({ progressive: true, }).toBuffer(),
            rotated.resize(100).toBuffer(),
            rotated.resize(250).toBuffer(),
            rotated.resize(500).toBuffer(),
            rotated.resize(1000).toBuffer(),
          ]);

          const modifyDate = (metadata.exif ? await getExifModifyDate(metadata.exif) : null) ?? new Date();

          const photoId = Math.floor(Math.random() * 0xffffffff).toString(16);

          const plant = plants.find(({id}) => id === plantId)!;
          plant.photos ??= [];
          plant.photos.push({ id: photoId, modifyDate: modifyDate.toISOString() });

          await mkdir(`photos/${plantId}/${photoId}`, { recursive: true });

          await Promise.all([
            writeFile(`photos/${plantId}/${photoId}/original.jpg`, rotatedOriginal),
            writeFile(`photos/${plantId}/${photoId}/progressive.jpg`, progressive),
            writeFile(`photos/${plantId}/${photoId}/size-100.jpg`, size100),
            writeFile(`photos/${plantId}/${photoId}/size-250.jpg`, size250),
            writeFile(`photos/${plantId}/${photoId}/size-500.jpg`, size500),
            writeFile(`photos/${plantId}/${photoId}/size-1000.jpg`, size1000),
            writeFile("plants.json", JSON.stringify(plants, null, "  "))
          ]);

          console.log(`Added`, plantId, photoId);

          return {
            status: 200,
            body: JSON.stringify({
              photoId,
              modifyDate: modifyDate?.toISOString(),
            }),
            headers: {
              "content-type": "application/json",
            }
          }
        }
      },
      {
        pattern: /^api\/deletePhoto$/,
        handler: async () => {
          const { photoId, plantId, } = JSON.parse(await getBody(req));
          const plant = plants.find(({id}) => id === plantId)!;
          if (plant == null) {
            throw new Error(`No plant found with id ${plantId}`);
          }
          const photoIndex = plant.photos.findIndex(({id}) => id === photoId);
          if (photoIndex === -1) {
            throw new Error(`No photo found with id ${photoId}`);
          }
          const deletedPhoto = plant.photos.splice(photoIndex, 1);
          await rm(`photos/${plantId}/${photoId}`, { recursive: true });
          await writeFile("plants.json", JSON.stringify(plants, null, "  "));
          console.log(`Deleted ${JSON.stringify(deletedPhoto)}`);
          return {
            status: 200,
            body: JSON.stringify({}),
            headers: {
              "content-type": "application/json",
            }
          }
        }
      },
      {
        pattern: /^page.css$/,
        handler: async () => {
          return { 
            status: 200, 
            body: await readFile("src/page.css"),
            headers: {
              "content-type": "text/css",
            }
          };
        }
      },
      {
        pattern: /^page.js$/,
        handler: async () => {
          return { 
            status: 200, 
            body: await readFile("dist/page.js"),
            headers: {
              "content-type": "application/javascript",
            }
          };
        }
      },
      {
        pattern: /^data\/photos\/(?<filename>.*)$/,
        handler: async (match: RegExpMatchArray) => {
          let body;
          try {
            body = await readFile(`photos/${match.groups!["filename"]}`);
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code == "ENOENT") {
              return {
                status: 404,
                body: "Not found",
              };
            }
            throw e;
          }
          return { 
            status: 200, 
            body: body,
            headers: {
              "content-type": "image/jpeg",
            }
          };
        }
      },
    ];
    
    let response: { status: number, body: string|Buffer, headers?: Record<string, string> } = {
      status: 404,
      body: `Not found`,
    };
    for (const { pattern, handler } of patterns) {
      const match = url.replace(/^\//, "").match(pattern);
      if (match != null) {
        response = await Promise.resolve(handler(match, new URL(url, "http://dev.plants.anasta.si")));
        break;
      }
    }

    res.writeHead(response.status, undefined, {
      "content-type": "application/json",
      ...(response.headers ?? {})
    });
    res.end(response.body);
  } catch (e) {
    console.error(`Internal Failure`, e);
    res.writeHead(500, undefined, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify({
      error: {
        message: (e as Error).message,
      }
    }));
  }
});

server.listen(parseInt(options["--port"]), () => {
  console.log(`Server is running on https://0.0.0.0:${options["--port"]}`);
});

async function getBody(req: http.IncomingMessage): Promise<string> {
  const contentType = req.headers["content-type"];
  if (contentType?.split(";")?.[0] != "application/json") {
    throw new Error(`Unexpected content type ${contentType}`);
  }
  const buffer = await new Promise<Buffer>(
    (resolve, reject) => {
      const body: Buffer[] = [];
      req.on('data', (chunk: Buffer) => { body.push(chunk); })
        .on('end', () => { resolve(Buffer.concat(body)); })
        .on('error', e => reject(e))
      }
    );
  return buffer.toString();
}