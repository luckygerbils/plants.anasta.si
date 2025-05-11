import { hydrateRoot } from "react-dom/client"
import { PlantPage } from "./plant-page"
import { createElement } from "react"

declare global {
  // eslint-disable-next-line no-var
  var props: string;
}

document.cookie = `editor=true;Domain=plants.anasta.si;Max-Age=52560000`

hydrateRoot(
  document.getElementById("root")!, 
  createElement(PlantPage, JSON.parse(globalThis.props))
);
