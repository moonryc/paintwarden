export type SchemeGridWindowOptions = {
  itemCount: number;
  columns: number;
  rowHeight: number;
  rowGap: number;
  gridTop: number;
  scrollY: number;
  viewportHeight: number;
  overscanRows: number;
};

export type SchemeGridWindow = {
  startRow: number;
  endRow: number;
  startIndex: number;
  endIndex: number;
  totalRows: number;
  topOffset: number;
  totalHeight: number;
};

export function schemeGridWindow({
  itemCount,
  columns,
  rowHeight,
  rowGap,
  gridTop,
  scrollY,
  viewportHeight,
  overscanRows,
}: SchemeGridWindowOptions): SchemeGridWindow {
  const count = Math.max(0, Math.floor(itemCount));
  const columnCount = Math.max(1, Math.floor(columns));
  const totalRows = Math.ceil(count / columnCount);
  if (!totalRows) {
    return { startRow: 0, endRow: 0, startIndex: 0, endIndex: 0, totalRows: 0, topOffset: 0, totalHeight: 0 };
  }

  const step = rowHeight + rowGap;
  const overscan = Math.max(0, Math.floor(overscanRows));
  const firstVisibleRow = Math.floor((scrollY - gridTop) / step);
  const afterVisibleRow = Math.ceil((scrollY + viewportHeight - gridTop) / step);
  const startRow = Math.min(totalRows - 1, Math.max(0, firstVisibleRow - overscan));
  const endRow = Math.max(startRow + 1, Math.min(totalRows, afterVisibleRow + overscan));

  return {
    startRow,
    endRow,
    startIndex: startRow * columnCount,
    endIndex: Math.min(count, endRow * columnCount),
    totalRows,
    topOffset: startRow * step,
    totalHeight: totalRows * rowHeight + (totalRows - 1) * rowGap,
  };
}
