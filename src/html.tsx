import React, { PropsWithChildren, use } from "react";

interface HtmlProps {
  title: string;
  props?: object,
  script?: string,
  css: string,
  assetHashes?: Record<string, string>,
}

export function Html({ title, children, props, script, css, assetHashes }: PropsWithChildren<HtmlProps>) {
  function assetWithHash(asset: string) {
    if (assetHashes && assetHashes[asset] == null) {
      throw new Error(`No hashed asset for ${asset} (${JSON.stringify(assetHashes)})`)
    }
    return assetHashes?.[asset] ?? asset;
  }

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content" />
        <meta name="theme-color" content="#223225"/>
        <link rel="icon" type="image/png" href={`/${assetWithHash("images/favicon-96x96.png")}`} sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href={`/${assetWithHash("images/favicon.svg")}`} sizes="any"  />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href={`/${assetWithHash("images/apple-touch-icon.png")}`} />
        <link rel="manifest" href={`/${assetWithHash("webmanifest.json")}`} />
        <title>{title}</title>
        <link rel="stylesheet" href={`/${assetWithHash(css)}`} />
        {props && <script>{`window.props = ${JSON.stringify(JSON.stringify(props))}`}</script>}
      </head>
      <body>  
        <main id="root">{children}</main>
        {!script && (
          <script>{`
            if (typeof localStorage !== "undefined" && localStorage.getItem("previously-logged-in") === "true"){
              document.body.classList.add("previously-logged-in");
             }
          `}</script>
        )}
        {script && <script src={`/${assetWithHash(script)}`}></script>}
      </body>
    </html>
  );
}