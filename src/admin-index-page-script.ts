import { hydrateRoot } from "react-dom/client"
import { createElement } from "react"
import { AdminIndexPage } from "./admin-index-page";

declare global {
  // eslint-disable-next-line no-var
  var props: string;
}

const search = new URLSearchParams(location.search);
hydrateRoot(
  document.getElementById("root")!, 
  createElement(AdminIndexPage, {})
);
