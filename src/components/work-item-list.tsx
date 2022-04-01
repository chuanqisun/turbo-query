import FlexSearch from "flexsearch";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BugIcon } from "./icons/bug-icon";
import { CheckboxIcon } from "./icons/checkbox-icon";
import { CrownIcon } from "./icons/crown-icon";
import { TrophyIcon } from "./icons/trophy-icon";
import { patHeader } from "./shared/auth";
import { env } from "./shared/env";

const index = new FlexSearch.Document<IndexedItem>({
  preset: "match",
  worker: true,
  tokenize: "full",
  document: {
    id: "id",
    index: ["System.Title"],
  },
});

interface IndexedItem {
  id: number;
  "System.Title": string;
}

export const WorkItemList = () => {
  const [query, setQuery] = useState("");
  const [allItems, setAllItems] = useState<WorkItem<BasicFields>[]>([]);
  const [searchResult, setSearchResult] = useState<WorkItem<BasicFields>[]>([]);

  useEffect(() => {
    indexAllItems().then(setAllItems);
  }, []);

  const recentItems = useMemo(() => allItems.slice(0, 100), [allItems]);

  useEffect(() => {
    if (!query.trim().length) {
      setSearchResult([]);
    }

    index.searchAsync(query).then((matches) => {
      const titleMatchIds = matches.find((match) => match.field === "System.Title")?.result ?? [];
      // TODO index the index of each item in the allItems array, for O(1) lookup
      const matchedItems = titleMatchIds.map((id) => allItems.find((item) => item.id === id)!);
      setSearchResult(matchedItems);
    });
  }, [allItems, query]);

  const typeToIcon = useCallback((type: string) => {
    switch (type) {
      case "Deliverable":
        return <TrophyIcon width={16} fill="#005eff" />;
      case "Task":
        return <CheckboxIcon width={16} fill="#f2cb1d" />;
      case "Scenario":
        return <CrownIcon width={16} fill="#773b93" />;
      case "Bug":
        return <BugIcon width={16} fill="#cc293d" />;
    }
  }, []);

  return (
    <div>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      {query.length > 0 && (
        <section>
          <h2>Search</h2>
          <ul>
            {searchResult.map((item) => (
              <li key={item.id}>
                {typeToIcon(item.fields["System.WorkItemType"])}
                {item.fields["System.Title"]}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Recent</h2>
        <ul>
          {recentItems.map((item) => (
            <li key={item.id}>
              {typeToIcon(item.fields["System.WorkItemType"])}
              {item.fields["System.Title"]}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

async function indexAllItems() {
  const start = performance.now();
  const allIds = await getAllWorkItemIds();
  const pagedIds = getPagedIds(allIds);

  const pages = await Promise.all(
    pagedIds.map(async (ids) => {
      const items = await getWorkItems(["System.Title", "System.WorkItemType"], ids);
      items.map((item) =>
        index.add({
          id: item.id,
          "System.Title": item.fields["System.Title"],
        })
      );
      return items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    })
  );

  const allItems = pages.flat();

  const duration = performance.now() - start;
  console.log((duration / 1000).toFixed(2));

  return allItems;
}

function getAllWorkItemIds(): Promise<number[]> {
  return fetch(`https://dev.azure.com/Microsoft/OS/HITS/_apis/wit/wiql/${env.rootQueryId}?api-version=6.0`, {
    headers: { ...patHeader },
  })
    .then((result) => result.json())
    .then((result) => {
      return (result.workItems as { id: number }[]).map((item) => item.id);
    });
}

function getWorkItems(fields: string[], ids: number[]): Promise<WorkItem<BasicFields>[]> {
  return fetch(`https://dev.azure.com/Microsoft/OS/_apis/wit/workitemsbatch?api-version=6.0`, {
    method: "post",
    headers: { ...patHeader, "Content-Type": "application/json" },
    body: JSON.stringify({
      ids,
      fields,
    }),
  })
    .then((result) => result.json())
    .then((result: BatchSummary<BasicFields>) => {
      return result.value;
    });
}

function getPagedIds(allIds: number[]): number[][] {
  const pages: number[][] = [];
  for (var i = 0; i < allIds.length; i += 200) pages.push(allIds.slice(i, i + 200));
  return pages;
}

interface BatchSummary<FieldsType extends {}> {
  count: number;
  value: WorkItem<FieldsType>[];
}

interface WorkItem<FieldsType extends {}> {
  id: number;
  rev: number;
  fields: FieldsType;
  url: string;
}

interface BasicFields {
  "System.Title": string;
  "System.WorkItemType": string;
}
