import { db, DbWorkItemType } from "../../db/db";
import { WorkItemType } from "../ado/api-proxy";

export class MetadataManager extends EventTarget {
  #initialData = db.workItemTypes.toArray();
  #metadataDictionary = new Map<string, WorkItemTypeMetadata>();
  #imageRequests = new Map<string, Promise<Blob>>();

  constructor() {
    super();
    this.initMetadataDictionary(this.#initialData);
  }

  async initMetadataDictionary(workItemTypesAsync: Promise<DbWorkItemType[]>) {
    const workItemTypes = await workItemTypesAsync;
    if (!workItemTypes.length) return;

    const metadataEntry: [string, WorkItemTypeMetadata][] = workItemTypes.map((workItemType) => [
      workItemType.name,
      {
        iconSrcUrl: workItemType.icon.url,
        iconBlobUrl: URL.createObjectURL(workItemType.icon.image),
        states: new Map(workItemType.states.map((state) => [state.name, { color: state.color, category: state.category }])),
      },
    ]);

    this.#metadataDictionary = new Map(metadataEntry);
  }

  async reset() {
    await db.workItemTypes.clear();
    this.#imageRequests.clear();
  }

  async updateMetadataDictionary(itemTypes: WorkItemType[]) {
    // TODO expose hooks to track icon download progress
    const itemTypeSyncTasks = itemTypes
      .filter((itemType) => !itemType.isDisabled)
      .map(async (itemType) => {
        let imageAsync = this.#imageRequests.get(itemType.icon.url);
        if (!imageAsync) {
          imageAsync = fetch(itemType.icon.url).then((result) => result.blob());
          this.#imageRequests.set(itemType.icon.url, imageAsync);
        }

        const image = await imageAsync;
        await db.workItemTypes.put({
          name: itemType.name,
          icon: {
            url: itemType.icon.url,
            image,
          },
          states: itemType.states,
        });
      });
    // TODO remove icons that are not in the list
    await Promise.all(itemTypeSyncTasks);
    console.log(`[metadata] Metadata updated`);

    // TODO generate summary on what's changed
    // TODO emit change event
  }

  async getTypeIconBlobUrl(workItemType: string): Promise<string | undefined> {
    return this.#metadataDictionary.get(workItemType)?.iconBlobUrl;
  }
  async getStateDisplayConfig(workItemType: string, state: string): Promise<StateMetadata | undefined> {
    return this.#metadataDictionary.get(workItemType)?.states.get(state);
  }
}

export interface WorkItemTypeMetadata {
  iconSrcUrl: string;
  iconBlobUrl: string;
  states: Map<string, StateMetadata>;
}

export interface StateMetadata {
  color: string;
  category: string;
}
