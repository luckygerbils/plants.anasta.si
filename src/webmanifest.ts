export function webmanifest(instance: string, assetHashes?: Record<string, string>,) {
  const host = {
    Dev: "dev.plants.anasta.si:8443",
    Beta: "beta.plants.anasta.si",
    Prod: "plants.anasta.si"
  }[instance];

  function assetWithHash(asset: string) {
    if (assetHashes && assetHashes[asset] == null) {
      throw new Error(`No hashed asset for ${asset} (${JSON.stringify(assetHashes)})`)
    }
    return assetHashes?.[asset] ?? asset;
  }

  return {
    "id": `https://${host}`,
    "name": host,
    "short_name": `Plants${instance != "Prod" ? `(${instance})` : ""}`,
    "start_url": "/",
    "icons": [
      {
        "src": `/${assetWithHash("images/favicon.svg")}`,
        "sizes": "144x144",
        "type": "image/svg+xml"
      },
      {
        "src": `/${assetWithHash("images/web-app-manifest-192x192.png")}`,
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "maskable"
      },
      {
        "src": `/${assetWithHash("images/web-app-manifest-512x512.png")}`,
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "maskable"
      }
    ],
    "theme_color": "#223225",
    "background_color": "#223225",
    "display": "standalone"
  };
}
