import { readFile, writeFile } from "node:fs/promises";
import { renderToString } from "react-dom/server";
import React from "react";

import { Page } from "./src/page";

const redirects = 
  (await readFile("redirects.csv", "utf8"))
        .split("\n").filter(line => line.length > 0)
        .map(line => line.split(","))

await Promise.all(
  redirects.map(([ id, name, link ]) => 
    writeFile(
      `dist/${id}/index.html`, 
      "<!DOCTYPE html>\n" + renderToString(React.createElement(Page, { id, name, link }))
    ))
)