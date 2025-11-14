import { ENV } from '@/constants/env'
import { getDb } from '@/database'
import { getMqttClient } from '@/providers/broker'
import type { Collection } from 'mongodb'

const MQTT_TOPIC = ENV.MQTT_TOPIC
const MONGO_COLLECTION = 'readings'

async function onMessageReceived(topic: string, payload: Buffer): Promise<void> {
  console.log(`📩 Message received on topic: ${topic}`)

  try {
    console.log(`Payload: ${payload.toString()}`)
    const data = JSON.parse(payload.toString())

    const documentToInsert = {
      ...data,
      topic: topic,
    }

    const db = await getDb()
    const collection: Collection = db.collection(MONGO_COLLECTION)

    console.log(documentToInsert)
    const result = await collection.insertOne(documentToInsert)
    console.log(
      `✅ Data inserted into '${MONGO_COLLECTION}' with ID: ${result.insertedId}`,
    )
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('❌ Error: Received malformed JSON.', payload.toString())
    } else {
      console.error('❌ Failed to process or insert message into MongoDB:', error)
    }
  }
}

export async function startDataIngestion(): Promise<void> {
  try {
    console.log('🚀 Starting data ingestion service...')

    await getDb()

    const mqttClient = getMqttClient()

    mqttClient.subscribe(MQTT_TOPIC, (err) => {
      if (err) {
        console.error(`❌ Failed to subscribe to topic '${MQTT_TOPIC}'`, err)
        process.exit(1)
      } else {
        console.log(`👂 Subscribed successfully to topic: ${MQTT_TOPIC}`)
      }
    })

    mqttClient.on('message', onMessageReceived)
  } catch (error) {
    console.error(
      '🔥 A critical error occurred while starting the ingestion service:',
      error,
    )
    process.exit(1)
  }
}
