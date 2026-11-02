export function cleanCategoryName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ')
  if (!name || name.length > 50) throw new Error('Enter a category name between 1 and 50 characters.')
  if (['all items', '__add_category__'].includes(name.toLowerCase())) throw new Error('Choose a different category name.')
  return name
}
export function categoryId(name: string): string { return encodeURIComponent(cleanCategoryName(name).toLowerCase()) }
export function mergeCategories(...groups: string[][]): string[] {
  const seen = new Set<string>(['all items'])
  const result = ['All items']
  for (const name of groups.flat()) {
    const clean = name.trim().replace(/\s+/g, ' ')
    const key = clean.toLowerCase()
    if (clean && !seen.has(key)) { seen.add(key); result.push(clean) }
  }
  return result
}
