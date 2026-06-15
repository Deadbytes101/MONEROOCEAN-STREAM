import { isFiniteNumber } from "./format.js";

export const PAGE_SIZES = [15, 50, 100];
export const MAX_ROUTE_PAGE = 999;

export function routePageNumber(value) {
  const page = Number(value || 1);
  // Floor before clamping so a fractional page in (0,1) becomes 1, not 0 (a 0 here
  // would request a negative API page offset downstream).
  return isFiniteNumber(page) && page > 0 ? Math.max(1, Math.min(MAX_ROUTE_PAGE, Math.floor(page))) : 1;
}

export function blockPageSize(value) {
  const size = Number(value || PAGE_SIZES[0]);
  return PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0];
}

export function pageCountFor(totalCount, pageSize) {
  const total = Number(totalCount);
  const size = Number(pageSize);
  return isFiniteNumber(total) && total > 0 && isFiniteNumber(size) && size > 0
    ? Math.min(MAX_ROUTE_PAGE, Math.max(1, Math.ceil(total / size)))
    : 1;
}

export function pageBounds(totalCount, limit, page, rowCount) {
  const pageCount = pageCountFor(totalCount, limit);
  return { pageCount, hasNext: page < pageCount || (!totalCount && rowCount >= limit) };
}

export function pageQuery(page = 1, pageSize = PAGE_SIZES[0]) {
  const size = blockPageSize(pageSize);
  return page > 1 ? `page=${page}&limit=${size}` : `limit=${size}`;
}
