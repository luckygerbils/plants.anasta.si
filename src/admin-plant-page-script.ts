import { hydrateRoot } from "react-dom/client"
import { AdminPlantPage } from "./admin-plant-page"
import { createElement } from "react"

declare global {
  // eslint-disable-next-line no-var
  var props: string;
}

const search = new URLSearchParams(location.search);
const plantId = search.get("plantId") ?? undefined;
const edit = search.get("edit") === "true";
hydrateRoot(
  document.getElementById("root")!, 
  createElement(AdminPlantPage, { plantId, edit, })
);
