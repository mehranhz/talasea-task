import type { MetadataRoute } from "next";
import messages from "../../messages/fa.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.manifest.name,
    short_name: messages.manifest.shortName,
    description: messages.manifest.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f2ee",
    theme_color: "#f4f2ee",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
