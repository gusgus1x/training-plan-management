export const slugify = (title: string) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const withSlug = <T extends { title: string }>(
  item: T,
): T & { slug: string } => ({ ...item, slug: slugify(item.title) });
