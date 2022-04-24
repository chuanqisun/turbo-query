import FlexSearch, { IndexOptionsForDocumentSearch } from "flexsearch";

const indexConfig: IndexOptionsForDocumentSearch<IndexedItem> = {
  preset: "match",
  worker: true,
  charset: "latin:advanced",
  tokenize: "forward",
  document: {
    id: "id",
    index: ["fuzzyTokens"],
  },
};

export const index = new FlexSearch.Document<IndexedItem>(indexConfig);
export const cachedIndex = new FlexSearch.Document<IndexedItem>(indexConfig);

export interface IndexedItem {
  id: number;
  fuzzyTokens: string;
}
