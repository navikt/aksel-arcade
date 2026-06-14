# Preview fullscreen share-opening intent

Web share URLs may carry `previewFullscreen: true` as an optional opening intent when generated from Preview fullscreen, while normal share URLs, durable **Arcade project** data, and `.akselarcade` packages do not carry Preview fullscreen. This keeps Preview fullscreen as a tab-local Arcade layout preference, but lets a shared review link recreate the sender's intended opening surface without expanding the portable project/package boundary.
