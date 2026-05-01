import Database from "@tauri-apps/plugin-sql";
import { isTauri } from "./tauri";

const DB_URL = "sqlite:seedance.db";

let dbPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (!isTauri) {
    throw new Error("SQL plugin only available inside the Tauri runtime");
  }
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}
