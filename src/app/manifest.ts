import type { MetadataRoute } from "next";

// Web app manifest: lets Android (Chrome) install SpecLoop to the home screen
// and open it full-screen like an app. Served at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SpecLoop Academy",
    short_name: "SpecLoop",
    description: "Short narrated I&C lessons, recall quizzes, field scenarios, and spaced review.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f6f8",
    theme_color: "#0f6e68",
    categories: ["education"],
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", short_name: "Today", url: "/today", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Review queue", short_name: "Review", url: "/review", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
