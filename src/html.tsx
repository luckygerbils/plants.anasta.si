import { PlantPage } from "./plant-page";

export function Page(props: Parameters<typeof PlantPage>[0]) {
  return (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content" />
          <meta name="theme-color" content="#223225"/>
          <link rel="icon" href="images/favicon.svg" sizes="any" type="image/svg+xml" />
          <title>{props.plant.name}</title>
          <link rel="stylesheet" href="/page.css" />
          {props.dev && <script>{`window.props = ${JSON.stringify(JSON.stringify(props))}`}</script>}
        </head>
        <body>  
          <main id="root"><PlantPage {...props}/></main>
          {props.dev && <script src="/page.js"></script>}
        </body>
      </html>
  )
}