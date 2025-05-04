interface PageProps {
  plant: {
    id: string,
    name: string,
    scientificName?: string,
    photos?: { id: string }[],
    links: { site: string, url: string }[],
  },
  prev: string,
  next: string,
}

export function Page({
  plant: {
    id: plantId,
    name,
    scientificName,
    links,
    photos,
  },
  prev,
  next,
}: PageProps) {
  
  return (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content" />
          <meta name="theme-color" content="#223225"/>
          <link rel="icon" href="images/favicon.svg" sizes="any" type="image/svg+xml" />
          <title>{name}</title>
          <link rel="stylesheet" href="/page.css" />
        </head>
        <body>
          <header>
            <h1>{name}</h1>
            {scientificName && <h2 className="scientific-name">{scientificName}</h2>}
          </header>
          {/* <nav>
            {prev && <a href={`/${prev}`}>Prev</a>}
            {next && <a href={`/${next}`}>Next</a>}
          </nav> */}
          <section className="links">
            <ul>
              {(links ?? []).map(({site, url}) => 
                <li key={site}><a href={url}>{site}</a></li>)}
            </ul>
          </section>
          <section className="photos">
            <ul>
              {(photos ?? []).map(({id}) => <li key={id}><img loading="lazy" src={`https://beta.botanami.anasta.si/data/photos/${plantId}/${id}/original.jpg`} /></li>)}
            </ul>
          </section>
        </body>
      </html>
  )
}