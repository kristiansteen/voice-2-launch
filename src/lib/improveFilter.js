// The category chips only show when there are two or more categories, so a
// filter whose category is gone (deleted, regenerated, other flow) or whose
// chips are hidden must fall back to 'all' — never an empty list with no way back.
export function resolveCategoryFilter(filter, improvements) {
  const cats = new Set((improvements || []).map(i => i.category).filter(Boolean));
  if (filter === 'all' || cats.size < 2 || !cats.has(filter)) return 'all';
  return filter;
}
