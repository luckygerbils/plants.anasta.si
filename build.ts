import { mkdir, readFile, writeFile } from "node:fs/promises";
import { renderToString } from "react-dom/server";
import React from "react";

import { Page } from "./src/page";

const redirects = 
  (await readFile("redirects.csv", "utf8"))
        .split("\n").filter(line => line.length > 0)
        .map(line => line.split(","))

const results = await Promise.all(
  redirects.map(async ([ id, name, link ]) => 
    {
      try {
        await mkdir(`dist/${id}`, { recursive: true });
        await writeFile(
          `dist/${id}/index.html`,
          "<!DOCTYPE html>\n" + renderToString(React.createElement(Page, { id, name, link }))
        );
        return `Built ${id}: ${name}`
      } catch (e) {
        return `Error ${id}: ${e}`
      }
    })
)

for (const result of results) {
  console.log(result);
}