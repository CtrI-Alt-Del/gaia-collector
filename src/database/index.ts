import { ENV } from '@/constants/env'
import { MongoClient, type Db } from 'mongodb'
let client: MongoClient | null = null
let db: Db | null = null

export async function getDb(): Promise<Db> {
  if (db) {
    return db
  }

  if (!client) {
    console.log('Creating new MongoDB client...')
    client = new MongoClient(
      'mongodb+srv://dev-gaia-mongo-database:D5ZPuheVYS4ds8KN@dev-gaia-cluester.q0oywa5.mongodb.net/?retryWrites=true&w=majority&appName=dev-gaia-cluester',
    )
  }

  try {
    await client.connect()
    console.log('✅ Database connected successfully!')

    db = client.db()
    return db
  } catch (error) {
    console.error('❌ Failed to connect to the database', error)
    process.exit(1)
  }
}

export async function disconnectFromDb(): Promise<void> {
  if (client) {
    console.log('🔌 Disconnecting from database...')
    await client.close()
    client = null
    db = null
    console.log('Database disconnected.')
  }
}
