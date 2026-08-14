"use client";

import { useRouter } from "next/navigation";

type SectionTopic = { slug: string; locked?: boolean };

// Shared by every center_factory module shell (Master Data, Training Course,
// Training Plan, Training Record, Report): each has a grid of sub-tabs routed
// as /<basePath>/[section]. A locked or unknown slug falls back to the grid.
export const useSectionNavigation = <T extends SectionTopic>(
  basePath: string,
  items: readonly T[],
  selectedSlug: string | null | undefined,
) => {
  const router = useRouter();
  const selectedItem =
    (selectedSlug &&
      items.find((item) => item.slug === selectedSlug && !item.locked)) ||
    null;

  const openSection = (item: T) => {
    if (item.locked) {
      return;
    }
    router.push(`${basePath}/${item.slug}`);
  };

  const goToGrid = () => router.push(basePath);

  return { selectedItem, openSection, goToGrid };
};
