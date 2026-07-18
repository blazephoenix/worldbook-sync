/** Prefix that marks a world file as plugin-managed and readable in ST's world list. */
const BOOK_PREFIX = 'Universe - ';

/** Derive a filesystem-safe universe book name from a franchise display name. */
export function universeBookName(display: string): string {
  const safe = display
    .replace(/[\\/:*?"<>|]/g, ' ') // characters that are hostile in a filename → space
    .replace(/\s+/g, ' ')
    .trim();
  return `${BOOK_PREFIX}${safe}`;
}

/** True if a world name follows the plugin's universe-book naming convention. */
export function isPluginBookName(name: string): boolean {
  return name.startsWith(BOOK_PREFIX) && name.length > BOOK_PREFIX.length;
}
