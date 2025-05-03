interface PageProps {
  id: string,
  name: string,
  link: string,
}

export function Page({
  name, link
}: PageProps) {
  return (
      <html>
        <head>
          <title>{name}</title>
        </head>
        <body>
          <h1>{name}</h1>
          <a href={link}>Wikipedia</a>
        </body>
      </html>
  )
}