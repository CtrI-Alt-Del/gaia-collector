import { envSchema } from '@/schemas/env-schema'
import 'dotenv/config'

const env = {
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL,
  MQTT_USERNAME: process.env.MQTT_USERNAME,
  MQTT_PASSWORD: process.env.MQTT_PASSWORD,
  MQTT_TOPIC: process.env.MQTT_TOPIC,
  MQTT_PORT: process.env.MQTT_PORT,
  MONGO_URI: process.env.MONGO_URI,
  GAIA_SERVER_URL: process.env.GAIA_SERVER_URL,
  PORT: process.env.PORT,
}

console.log(env)

const parsedEnv = envSchema.safeParse(env)

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format())
  process.exit(1)
}

export const ENV = parsedEnv.data
