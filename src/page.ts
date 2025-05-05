import { hydrateRoot } from "react-dom/client"
import { PlantPage } from "./plant"
import { createElement } from "react"

declare global {
  // eslint-disable-next-line no-var
  var props: string;
}

hydrateRoot(
  document.getElementById("root")!, 
  createElement(PlantPage, JSON.parse(globalThis.props))
);
