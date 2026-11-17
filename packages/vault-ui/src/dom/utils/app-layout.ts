/** Clearance for keyboard navigation into a windowed list, below the shell and its filters. */
export function appScrollOffset() {
  const toolbar = document.querySelector<HTMLElement>("[data-filter-toolbar]");
  if (toolbar)
    return (parseFloat(getComputedStyle(toolbar).top) || 0) + toolbar.getBoundingClientRect().height + 8;
  return (document.querySelector("main > header")?.getBoundingClientRect().bottom ?? 0) + 8;
}
