import { Bookmarks, Eyedropper, Figure, Heart, LayoutDashboard, PaintDrop, Palette } from "../icons";
import type { Tab } from "../types";

// The app's pages as the navigation lists them, grouped into sections.

type NavLabelKey =
  | "layoutWorkbench"
  | "layoutCollection"
  | "layoutMiniatures"
  | "layoutPaints"
  | "layoutWishlist"
  | "layoutPainting"
  | "layoutSchemes"
  | "layoutTemplates"
  | "layoutPaintTools";

type NavItem = [Tab, typeof LayoutDashboard, NavLabelKey];

/** Navigation grouped by what the user is doing: tracking stuff, planning paint jobs, or managing catalogs. */
export const NAV_SECTIONS: { label?: NavLabelKey; items: NavItem[] }[] = [
  { items: [["dashboard", LayoutDashboard, "layoutWorkbench"]] },
  {
    label: "layoutCollection",
    items: [
      ["miniatures", Figure, "layoutMiniatures"],
      ["paints", PaintDrop, "layoutPaints"],
      ["wishlist", Heart, "layoutWishlist"],
    ],
  },
  {
    label: "layoutPainting",
    items: [
      ["schemes", Palette, "layoutSchemes"],
      ["templates", Bookmarks, "layoutTemplates"],
      ["paint-tools", Eyedropper, "layoutPaintTools"],
    ],
  },
];

export const NAV: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);
