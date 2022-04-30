import { db, DbWorkItemState, DbWorkItemType } from "../../db/db";
import { WorkItemState, WorkItemType } from "../ado/api-proxy";

export class MetadataManager extends EventTarget {
  #initialData = db.workItemTypes.toArray();
  #metadataAsync = this.initMetadata();
  #networkCacheAsync = this.initNetworkCache();

  constructor() {
    super();

    Promise.all([this.#metadataAsync, this.#networkCacheAsync]).then(() =>
      this.dispatchEvent(new CustomEvent<MetadataChangedUpdate>("changed", { detail: { timestamp: Date.now() } }))
    );
  }

  async getMap(): Promise<MetadataMap> {
    return this.#metadataAsync;
  }

  async initMetadata() {
    return this.#getMapFromDbWorkItemType(await this.#initialData);
  }

  async initNetworkCache() {
    const workItemTypes = await this.#initialData;

    // pre-populate network cache with existing items
    // TODO bust the cache if over max age
    const imageRequestEntries = workItemTypes.map(
      (workItemType) => [workItemType.icon.url, Promise.resolve(workItemType.icon.image)] as [string, Promise<Blob>]
    );
    console.log(`[metadata-manager] cache restored for ${imageRequestEntries.length} URLs`);
    return new Map(imageRequestEntries);
  }

  async reset() {
    await db.workItemTypes.clear();
    (await this.#networkCacheAsync).clear();
  }

  async updateMetadataDictionary(itemTypes: WorkItemType[], onProgress?: (update: MetadataSyncProgressUpdate) => any): Promise<MetadataSyncSummary> {
    const networkCache = await this.#networkCacheAsync;

    const activeTypes = itemTypes.filter((type) => !type.isDisabled);
    let progress = 0;
    let fetchCount = 0;
    onProgress?.({ progress, total: activeTypes.length });

    const dbItemsAsync = activeTypes.map(async (itemType) => {
      let imageAsync = networkCache.get(itemType.icon.url);
      if (!imageAsync) {
        fetchCount++;
        imageAsync = fetch(itemType.icon.url).then((result) => result.blob());
        networkCache.set(itemType.icon.url, imageAsync);
      }

      const image = await imageAsync;

      const dbItem: DbWorkItemType = {
        name: itemType.name,
        icon: {
          url: itemType.icon.url,
          image,
        },
        states: itemType.states,
      };

      await db.workItemTypes.put(dbItem);

      progress++;
      onProgress?.({ progress, total: activeTypes.length });

      return dbItem;
    });

    const dbItems = await Promise.all(dbItemsAsync);

    this.#metadataAsync = Promise.resolve(this.#getMapFromDbWorkItemType(dbItems));

    console.log(`[metadata] Metadata updated`);
    this.dispatchEvent(new CustomEvent<MetadataChangedUpdate>("changed", { detail: { timestamp: Date.now() } }));

    return {
      itemTypeCount: activeTypes.length,
      fetchCount,
    };
  }

  #getMapFromDbWorkItemType(workItemTypes: DbWorkItemType[]) {
    const metadataEntry: [string, WorkItemTypeMetadata][] = workItemTypes.map((workItemType) => [
      workItemType.name,
      {
        iconSrcUrl: workItemType.icon.url,
        iconBlobUrl: URL.createObjectURL(workItemType.icon.image),
        states: this.getStateMap(workItemType.states),
      },
    ]);

    return new Map(metadataEntry);
  }

  getStateMap(states: DbWorkItemState[] | WorkItemState[]) {
    return new Map(states.map((state) => [state.name, { color: state.color, category: state.category }]));
  }
}

export type MetadataMap = Map<string, WorkItemTypeMetadata>;

export interface WorkItemTypeMetadata {
  iconSrcUrl: string;
  iconBlobUrl: string;
  states: Map<string, StateMetadata>;
}

export interface StateMetadata {
  color: string;
  category: string;
}

export interface MetadataChangedUpdate {
  timestamp: number;
}

export interface MetadataSyncProgressUpdate {
  progress: number;
  total: number;
}

export interface MetadataSyncSummary {
  itemTypeCount: number;
  fetchCount: number;
}
