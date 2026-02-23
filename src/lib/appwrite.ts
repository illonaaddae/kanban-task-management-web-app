import { Client, Account, Databases, Storage } from "appwrite";

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(
    import.meta.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",
  )
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || "");

// Initialize services
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

// Export client for advanced usage
export { client };
export default client;

// Database and collection IDs
export const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID || "kanban-db";
export const BOARDS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_BOARDS_COLLECTION_ID || "boards";
export const TASKS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_TASKS_COLLECTION_ID || "tasks";
export const STORAGE_BUCKET_ID =
  import.meta.env.VITE_APPWRITE_BUCKET_ID || "profile-pictures";
