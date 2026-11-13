import { Bookmarks, Eyedropper, Figure, Heart, LayoutDashboard, PaintDrop, Palette } from "../icons";
import type { Tab } from "../types";

// The app's pages as the navigation lists them, grouped into sections.

type NavItem = [Tab, typeof LayoutDashboard, string];

/** Navigation grouped by what the user is doing: tracking stuff, planning paint jobs, or managing catalogs. */
export const NAV_SECTIONS: { label?: string; items: NavItem[] }[] = [
  { items: [["dashboard", LayoutDashboard, "Workbench"]] },
  {
    label: "Collection",
    items: [
      ["miniatures", Figure, "Miniatures"],
      ["paints", PaintDrop, "Paints"],
      ["wishlist", Heart, "Wishlist"],
    ],
  },
  {
    label: "Painting",
    items: [
      ["schemes", Palette, "Schemes"],
      ["templates", Bookmarks, "Templates"],
      ["paint-tools", Eyedropper, "Paint Tools"],
    ],
  },
];

export const NAV: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);
