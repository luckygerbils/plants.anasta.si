import { hydrateRoot } from "react-dom/client"
import { EditPlantPage } from "./plant-page"
import { createElement } from "react"

declare global {
  // eslint-disable-next-line no-var
  var props: string;
}

document.cookie = `editor=true;Domain=plants.anasta.si;Max-Age=52560000`;

const plantId = new URLSearchParams(location.search).get("plantId") ?? undefined;
hydrateRoot(
  document.getElementById("root")!, 
  createElement(EditPlantPage, { plantId })
);
