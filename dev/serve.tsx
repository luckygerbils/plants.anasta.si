/**
 * A server for local testing and uploading
 */

import https from "node:https";
import http, { IncomingMessage } from "node:http";
import process from "node:process";
import sharp from "sharp";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { renderToString } from "react-dom/server";
import { build } from 'esbuild'

import { getExifModifyDate } from "../src/lambda/exif";
import { comparing, nullsFirst, localeCompare } from "../src/util/sorting";
import { AdminPlantPage } from "../src/admin-plant-page";
import { Plant } from "../src/model/plant";
import { PublicPlantPage } from "../src/public-plant-page";
import { Html } from "../src/html";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { LoginPage } from "../src/login-page";
import { PublicIndexPage } from "../src/public-index-page";
import { extname } from "node:path";
import { AdminIndexPage } from "../src/admin-index-page";
// import { invoke } from "../src/lambda/api";

await Promise.all(
  [
    ["src/admin-index-page-script.ts", "dist/website/Beta/js/admin/index.js"],
    ["src/admin-plant-page-script.ts", "dist/website/Beta/js/admin/plant.js"],
    ["src/login-page-script.ts", "dist/website/Beta/js/login.js"],
    [`src/admin-index-page.css`, `dist/website/Beta/css/admin/index.css`],
    [`src/admin-plant-page.css`, `dist/website/Beta/css/admin/plant.css`],
    [`src/login-page.css`, `dist/website/Beta/css/login.css`],
    [`src/public-index-page.css`, `dist/website/Beta/css/index.css`],
    [`src/public-plant-page.css`, `dist/website/Beta/css/plant.css`],
  ].map(([ entryPoint, outfile ]) => build({
    entryPoints: [ entryPoint ],
    bundle: true,
    outfile: outfile,
    logLevel: "info",
  })),
)

const options = Object.fromEntries(process.argv.slice(2).map(arg => arg.split("=")) as [string, string][])

const plantsFile = `plants/Beta.json`
const plants = (JSON.parse(await readFile(plantsFile, "utf8")) as Plant[])
  .sort(comparing(p => p.tags.location, nullsFirst(localeCompare)));
const [ publicPlants, privatePlants ] = plants.reduce((result: [Plant[], Plant[]], plant) => {
  if (plant.tags.public === "true" && plant.tags.likelyDead !== "true") {
    result[0].push(plant);
  } else {
    result[1].push(plant);
  }
  return result;
}, [[], []]); 


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

let props;
if (existsSync("dev-props.json")) {
  props = JSON.parse(await readFile("dev-props.json", {encoding: "utf8"}));
} else {
  props = {
    region: "us-west-2",
    userPoolClientId: getResourceId("AWS::Cognito::UserPoolClient", "EditorUserPoolClient"),
    userPoolId: getResourceId("AWS::Cognito::UserPool", "EditorUserPool"),
    identityPoolId: getResourceId("AWS::Cognito::IdentityPool", "EditorIdentityPool"),
    apiUrl: getFunctionUrl(getResourceId("AWS::Lambda::Function", "ApiFunction")),
  };
  await writeFile("dev-props.json", JSON.stringify(props, null, " "))
} 

const server = https.createServer({ key, cert, }, async (req, res) => {
  const url = req.url ?? "/";

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
              <Html title={plant.name} css="css/plant.css">
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
      pattern: /^$/,
      handler: async () => {
        return { 
          status: 200, 
          body: "<!DOCTYPE html>\n" + renderToString(
              <Html title="All Plants" css="css/index.css">
                <PublicIndexPage allPlants={publicPlants} />
              </Html>
            ),
          headers: {
            "content-type": "text/html",
          }
        };
      }
    },
    {
      pattern: /^admin\/list/,
      handler: async (_: unknown, url: URL) => {
        return { 
          status: 200, 
          body: "<!DOCTYPE html>\n" + renderToString(
              <Html title="Admin" script="js/admin/index.js" css="css/admin/index.css" props={props}>
                <AdminIndexPage />
              </Html>
            ),
          headers: {
            "content-type": "text/html",
          }
        };
      }
    },
    {
      pattern: /^admin\/plant/,
      handler: async (_: unknown, url: URL) => {
        return { 
          status: 200, 
          body: "<!DOCTYPE html>\n" + renderToString(
              <Html title="Edit" script="js/admin/plant.js" css="css/admin/plant.css" props={props}>
                <AdminPlantPage />
              </Html>
            ),
          headers: {
            "content-type": "text/html",
          }
        };
      }
    },
    {
      pattern: /^login/,
      handler: async (_: unknown, url: URL) => {
        return { 
          status: 200, 
          body: "<!DOCTYPE html>\n" + renderToString(
              <Html title="Login" script="js/login.js" css="css/login.css" props={props}>
                <LoginPage />
              </Html>
            ),
          headers: {
            "content-type": "text/html",
          }
        };
      }
    },
    {
      pattern: /^css\/(?<filename>.*\.css)$/,
      handler: async (match: RegExpMatchArray) => {
        return { 
          status: 200, 
          body: await readFile(`dist/website/Beta/css/${match.groups!["filename"]}`),
          headers: {
            "content-type": "text/css",
          }
        };
      }
    },
    {
      pattern: /^images\/(?<filename>.*)$/,
      handler: async (match: RegExpMatchArray) => {
        const filename = match.groups!["filename"];
        const extension = extname(filename);
        return { 
          status: 200, 
          body: await readFile(`src/images/${filename}`),
          headers: {
            "content-type": `image/${{
              ".svg": "svg+xml",
              ".jpg": "jpeg",
            }[extension] ?? extname(filename).substring(1)}`
          }
        };
      }
    },
    {
      pattern: /^(?<filename>js\/.*\.js)$/,
      handler: async (match: RegExpMatchArray) => {
        return { 
          status: 200, 
          body: await readFile(`dist/website/Beta/${match.groups!["filename"]}`),
          headers: {
            "content-type": "application/javascript",
          }
        };
      }
    },
  ];

  try {
    let response: { status: number, body: string|Buffer, headers?: Record<string, string> } = {
      status: 404,
      body: `Not found`,
    };

    if (url.match(/^\/data\/.*/) || url.match(/^\/api\/.*/)) {
      // There is probably a better way to proxy this with Node APIs, but I keep getting openssl errors when doing that
      console.log(`Proxying ${url}`);
      const targetUrl = `https://beta.plants.anasta.si/${req.url?.replace(/^\//, "")}`;
      const request = new Request(targetUrl, {
          method: req.method,
          headers: Object.fromEntries(Object.entries(req.headersDistinct).map(([k, v]) => [k, v![0]])),
          body: await getBody(req),
        });
      const r = await fetch(request);
      const responseHeaders: Record<string, string> = {};
      r.headers.forEach((value, key) => {
        // Skip headers that shouldn't apply when developing (or because we are proxying the way we are)
        if (!["cache-control", "content-encoding"].includes(key.toLowerCase())) {
          responseHeaders[key] = value;
        }
      });
      response = {
        status: r.status,
        body: Buffer.from(await (await r.blob()).arrayBuffer()),
        headers: responseHeaders,
      };
    } else {
      for (const { pattern, handler } of patterns) {
        const match = url.replace(/^\//, "").match(pattern);
        if (match != null) {
          response = await Promise.resolve(handler(match, new URL(url, "http://dev.plants.anasta.si")));
          break;
        }
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

async function getBody(req: http.IncomingMessage): Promise<string|undefined> {
  const contentLength = req.headers["content-length"];
  if (contentLength == null || contentLength === "0") {
    return undefined;
  }

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