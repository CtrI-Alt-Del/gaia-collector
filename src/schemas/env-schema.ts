import { z } from "zod";

export const envSchema = z.object({
	MQTT_BROKER_URL: z.string({ message: "MQTT_BROKER_URL must be a valid URL." }),
	MQTT_USERNAME: z.string().min(1, { message: "MQTT_USERNAME is required." }),
	MQTT_PASSWORD: z.string().min(1, { message: "MQTT_PASSWORD is required." }),
	MQTT_TOPIC: z.string().min(1, { message: "MQTT_TOPIC is required." }),
  MQTT_PORT: z.coerce.number().int().positive().default(1883),
	MONGODB_URI: z.string({ message: "DATABASE_URL must be a valid URL." }),
	PORT: z.coerce.number().int().positive().default(4444),
	GAIA_SERVER_URL: z.url({ message: "GAIA_SERVER_URL must be a valid URL." }),
  CA_CERT_PATH: z.string().min(1, { message: "CA_CERT_PATH is required." }),
});

export type Env = z.infer<typeof envSchema>;
