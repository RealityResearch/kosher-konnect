import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JPS | Jewish Positioning System",
    short_name: "JPS",
    description:
      "Discover synagogues, kosher restaurants, Chabad houses, JCCs, and more across the United States.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a12",
    theme_color: "#0a0a12",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/logo.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
