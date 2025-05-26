import { hydrateRoot } from "react-dom/client"
import { createElement } from "react"
import { AdminIndexPage } from "./admin-index-page";

declare global {
  // eslint-disable-next-line no-var
  var props: string;
}

const search = new URLSearchParams(location.search);
const defaultFilterKey = search.keys().next().value;
const defaultFilterValue = (defaultFilterKey ? search.get(defaultFilterKey) : undefined) ?? undefined;
hydrateRoot(
  document.getElementById("root")!, 
  createElement(AdminIndexPage, { defaultFilterKey, defaultFilterValue })
);
