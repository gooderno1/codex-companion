import path from "node:path";

import type { DashboardSnapshot } from "../../shared/contracts";
import { readJsonFile, writeJsonFile } from "../utils/fs";

const SNAPSHOT_FILE_NAME = "snapshot.json";

export class SnapshotStore {
  private readonly snapshotPath: string;

  public constructor(userDataPath: string) {
    this.snapshotPath = path.join(userDataPath, SNAPSHOT_FILE_NAME);
  }

  public read(): Promise<DashboardSnapshot | null> {
    return readJsonFile<DashboardSnapshot>(this.snapshotPath);
  }

  public write(snapshot: DashboardSnapshot): Promise<void> {
    return writeJsonFile(this.snapshotPath, snapshot);
  }
}
