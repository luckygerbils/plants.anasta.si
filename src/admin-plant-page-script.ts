import { hydrateRoot } from "react-dom/client"
import { AdminPlantPage } from "./admin-plant-page"
import { createElement } from "react"

declare global {
  // eslint-disable-next-line no-var
  var props: string;
}

const plantId = new URLSearchParams(location.search).get("plantId") ?? undefined;
hydrateRoot(
  document.getElementById("root")!, 
  createElement(AdminPlantPage, { plantId })
);
