import FlexSearch from "flexsearch";
import React, { useEffect, useState } from "react";
import { db } from "../data/db";
import { indexAllItems, IndexedItem, loadCachedIndex } from "../utils/fts";

export interface UseSearchIndexInput {
  skip?: boolean;
  deps: React.DependencyList;
}

// Currenly primary + secondary index because Flexsearch has performance issue when updating an imported index
// When app initially opens, we import into secondary index (quick) and enables search
// Then we build a primary index from scratch (slow). When ready, we swap out secondary and swap in primary

export function useSearchIndex(input: UseSearchIndexInput) {
  const [indexRev, setIndexRev] = useState(0);
  const [activeIndex, setActiveIndex] = useState<FlexSearch.Document<IndexedItem, false>>();

  useEffect(() => {
    const startTime = performance.now();
    loadCachedIndex().then((cachedIndex) => {
      const duration = performance.now() - startTime;
      console.log(`[index] Cached index ready (${Math.round(duration)}ms)`);

      setActiveIndex(cachedIndex);
      setIndexRev((prev) => prev + 1);
    });
  }, []);

  useEffect(() => {
    if (input.skip) return;

    const startTime = performance.now();
    indexAllItems().then(async (index) => {
      const duration = performance.now() - startTime;
      console.log(`[index] primary index ready (${Math.round(duration)}ms)`);

      setActiveIndex(index);
      setIndexRev((prev) => prev + 1);

      db.indexItems.clear();
      index.export((key, value) => db.indexItems.put({ key: key as string, value: value as any as string | undefined }));
    });
  }, input.deps);

  return {
    rev: indexRev,
    index: activeIndex,
  };
}
