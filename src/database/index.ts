import { ENV } from "@/constants/env";
import { MongoClient, type Db } from "mongodb";
let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
	if (db) {
		return db;
	}

	if (!client) {
		console.log("Creating new MongoDB client...");
		client = new MongoClient(ENV.MONGODB_URI);
	}

	try {
		await client.connect();
		console.log("✅ Database connected successfully!");

		db = client.db();
		return db;
	} catch (error) {
		console.error("❌ Failed to connect to the database", error);
		process.exit(1);
	}
}

export async function disconnectFromDb(): Promise<void> {
	if (client) {
		console.log("🔌 Disconnecting from database...");
		await client.close();
		client = null;
		db = null;
		console.log("Database disconnected.");
	}
}
