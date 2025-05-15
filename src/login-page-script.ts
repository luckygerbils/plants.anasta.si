import { hydrateRoot } from "react-dom/client"
import { createElement } from "react"
import { LoginPage } from "./login-page";

hydrateRoot(
  document.getElementById("root")!, 
  createElement(LoginPage, { searchParams: new URLSearchParams(location.search) })
);
