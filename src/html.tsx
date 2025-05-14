import { PropsWithChildren } from "react";

interface HtmlProps {
  title: string;
  className?: string;
  props?: object,
  script?: string,
}

export function Html({ title, children, className, props, script }: PropsWithChildren<HtmlProps>) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content" />
        <meta name="theme-color" content="#223225"/>
        <link rel="icon" href="images/favicon.svg" sizes="any" type="image/svg+xml" />
        <title>{title}</title>
        <link rel="stylesheet" href="/page.css" />
        {props && <script>{`window.props = ${JSON.stringify(JSON.stringify(props))}`}</script>}
      </head>
      <body>  
        <main id="root" className={className}>{children}</main>
        {!script && (
          <script>{`
            if (Object.fromEntries(document.cookie.split(";").map(c => c.split("=").map(s => s.trim())))["editor"] === "true"){
              document.body.classList.add("editor");
             }
          `}</script>
        )}
        {script && <script src={script}></script>}
      </body>
    </html>
  );
}