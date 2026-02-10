import * as sdk from "node-appwrite";

// Configuration - Update these with your Appwrite credentials
const client = new sdk.Client();
client
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID || "YOUR_PROJECT_ID")
  .setKey(process.env.APPWRITE_API_KEY || "YOUR_API_KEY");

const databases = new sdk.Databases(client);

async function setupDatabase() {
  try {
    console.log("Setting up Appwrite database structure...\n");

    // Step 1: Create database
    console.log('1. Creating database "Kanban Database"...');
    try {
      const database = await databases.create("kanban-db", "Kanban Database");
      console.log("✓ Database created:", database.name);
    } catch (error) {
      if (error.code === 409) {
        console.log("✓ Database already exists");
      } else {
        throw error;
      }
    }

    // Step 2: Create "boards" collection
    console.log('\n2. Creating "boards" collection...');
    try {
      const boardsCollection = await databases.createCollection(
        "kanban-db",
        "boards",
        "Boards",
      );
      console.log("✓ Boards collection created");

      // Add attributes to boards collection
      console.log("  Adding attributes...");
      await databases.createStringAttribute(
        "kanban-db",
        "boards",
        "name",
        255,
        true,
      );
      console.log("  ✓ name attribute added");

      await databases.createStringAttribute(
        "kanban-db",
        "boards",
        "userId",
        255,
        true,
      );
      console.log("  ✓ userId attribute added");

      await databases.createStringAttribute(
        "kanban-db",
        "boards",
        "columns",
        10000,
        true,
      );
      console.log("  ✓ columns attribute added");

      await databases.createDatetimeAttribute(
        "kanban-db",
        "boards",
        "createdAt",
        true,
      );
      console.log("  ✓ createdAt attribute added");

      await databases.createDatetimeAttribute(
        "kanban-db",
        "boards",
        "updatedAt",
        true,
      );
      console.log("  ✓ updatedAt attribute added");

      // Wait a bit for attributes to be ready
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create index on boards collection
      console.log("  Creating index...");
      await databases.createIndex(
        "kanban-db",
        "boards",
        "userId_index",
        "key",
        ["userId"],
      );
      console.log("  ✓ userId_index created");
    } catch (error) {
      if (error.code === 409) {
        console.log("✓ Boards collection already exists");
      } else {
        throw error;
      }
    }

    // Step 3: Create "tasks" collection
    console.log('\n3. Creating "tasks" collection...');
    try {
      const tasksCollection = await databases.createCollection(
        "kanban-db",
        "tasks",
        "Tasks",
      );
      console.log("✓ Tasks collection created");

      // Add attributes to tasks collection
      console.log("  Adding attributes...");
      await databases.createStringAttribute(
        "kanban-db",
        "tasks",
        "title",
        255,
        true,
      );
      console.log("  ✓ title attribute added");

      await databases.createStringAttribute(
        "kanban-db",
        "tasks",
        "description",
        5000,
        false,
      );
      console.log("  ✓ description attribute added");

      await databases.createStringAttribute(
        "kanban-db",
        "tasks",
        "status",
        100,
        true,
      );
      console.log("  ✓ status attribute added");

      await databases.createStringAttribute(
        "kanban-db",
        "tasks",
        "boardId",
        255,
        true,
      );
      console.log("  ✓ boardId attribute added");

      await databases.createStringAttribute(
        "kanban-db",
        "tasks",
        "userId",
        255,
        true,
      );
      console.log("  ✓ userId attribute added");

      await databases.createStringAttribute(
        "kanban-db",
        "tasks",
        "subtasks",
        10000,
        false,
      );
      console.log("  ✓ subtasks attribute added");

      await databases.createDatetimeAttribute(
        "kanban-db",
        "tasks",
        "createdAt",
        true,
      );
      console.log("  ✓ createdAt attribute added");

      await databases.createDatetimeAttribute(
        "kanban-db",
        "tasks",
        "updatedAt",
        true,
      );
      console.log("  ✓ updatedAt attribute added");

      // Wait a bit for attributes to be ready
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create indexes on tasks collection
      console.log("  Creating indexes...");
      await databases.createIndex(
        "kanban-db",
        "tasks",
        "boardId_index",
        "key",
        ["boardId"],
      );
      console.log("  ✓ boardId_index created");

      await databases.createIndex("kanban-db", "tasks", "userId_index", "key", [
        "userId",
      ]);
      console.log("  ✓ userId_index created");
    } catch (error) {
      if (error.code === 409) {
        console.log("✓ Tasks collection already exists");
      } else {
        throw error;
      }
    }

    // Step 4: List all collections
    console.log("\n4. Listing all collections...");
    const collections = await databases.listCollections("kanban-db");
    console.log("\nCollections in Kanban Database:");
    collections.collections.forEach((col) => {
      console.log(`  - ${col.name} (ID: ${col.$id})`);
    });

    console.log("\n✅ Database setup completed successfully!");
  } catch (error) {
    console.error("\n❌ Error setting up database:", error.message);
    if (error.response) {
      console.error("Response:", error.response);
    }
    process.exit(1);
  }
}

setupDatabase();
