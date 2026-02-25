/**
 * Appwrite Database Setup Script
 * 
 * This script helps you set up the Appwrite database and collections
 * for the Kanban Task Manager app.
 * 
 * Run this after creating your Appwrite project to automatically
 * create the database structure.
 */

import { Client, Databases, ID } from 'appwrite';

const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '');

const databases = new Databases(client);

const DATABASE_ID = 'kanban-db';
const BOARDS_COLLECTION = 'boards';
const TASKS_COLLECTION = 'tasks';

async function setupDatabase() {
  try {
    console.log(' Starting Appwrite database setup...\n');

    // Create database
    console.log(' Creating database...');
    const database = await databases.create(DATABASE_ID, 'Kanban Database');
    console.log(' Database created:', database.name);

    // Create boards collection
    console.log('\n📋 Creating boards collection...');
    const boardsCollection = await databases.createCollection(
      DATABASE_ID,
      BOARDS_COLLECTION,
      'Boards'
    );
    console.log(' Boards collection created');

    // Add attributes to boards collection
    console.log('  Adding attributes...');
    await databases.createStringAttribute(DATABASE_ID, BOARDS_COLLECTION, 'name', 255, true);
    await databases.createStringAttribute(DATABASE_ID, BOARDS_COLLECTION, 'userId', 255, true);
    await databases.createStringAttribute(DATABASE_ID, BOARDS_COLLECTION, 'columns', 10000, true);
    await databases.createDatetimeAttribute(DATABASE_ID, BOARDS_COLLECTION, 'createdAt', true);
    await databases.createDatetimeAttribute(DATABASE_ID, BOARDS_COLLECTION, 'updatedAt', true);
    console.log(' Boards attributes created');

    // Create tasks collection
    console.log('\n📝 Creating tasks collection...');
    const tasksCollection = await databases.createCollection(
      DATABASE_ID,
      TASKS_COLLECTION,
      'Tasks'
    );
    console.log(' Tasks collection created');

    // Add attributes to tasks collection
    console.log('  Adding attributes...');
    await databases.createStringAttribute(DATABASE_ID, TASKS_COLLECTION, 'title', 255, true);
    await databases.createStringAttribute(DATABASE_ID, TASKS_COLLECTION, 'description', 5000, false);
    await databases.createStringAttribute(DATABASE_ID, TASKS_COLLECTION, 'status', 100, true);
    await databases.createStringAttribute(DATABASE_ID, TASKS_COLLECTION, 'boardId', 255, true);
    await databases.createStringAttribute(DATABASE_ID, TASKS_COLLECTION, 'userId', 255, true);
    await databases.createStringAttribute(DATABASE_ID, TASKS_COLLECTION, 'subtasks', 10000, false);
    await databases.createDatetimeAttribute(DATABASE_ID, TASKS_COLLECTION, 'createdAt', true);
    await databases.createDatetimeAttribute(DATABASE_ID, TASKS_COLLECTION, 'updatedAt', true);
    console.log(' Tasks attributes created');

    console.log('\ Database setup complete!');
    console.log('\ Next steps:');
    console.log('1. Go to Appwrite Console → Databases → kanban-db');
    console.log('2. Configure permissions for each collection');
    console.log('3. Update your .env file with the database ID');
    console.log('\nDatabase ID: kanban-db');
    console.log('Boards Collection ID: boards');
    console.log('Tasks Collection ID: tasks');

  } catch (error) {
    console.error('\❌ Error setting up database:', error);
    console.log('\💡 If the database already exists, you can skip this step.');
  }
}

// Run setup
setupDatabase();
