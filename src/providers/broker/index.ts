import { ENV } from "@/constants/env";
import { connect, type MqttClient } from "mqtt";

let client: MqttClient | null = null;

export function getMqttClient(): MqttClient {
	if (client) {
		return client;
	}

	const options = {
		host: ENV.MQTT_BROKER_URL,
		port: ENV.MQTT_PORT,
		username: ENV.MQTT_USERNAME,
		password: ENV.MQTT_PASSWORD,
		protocol: "mqtts" as const,
	};

	client = connect(options);

	client.on("connect", () => {
		console.log("✅ Connected to MQTT broker");
	});

	client.on("error", (error) => {
		console.error("❌ MQTT connection error:", error);
		client?.end();
		client = null;
	});

	client.on("close", () => {
		console.log("🔌 Disconnected from MQTT broker");
		client = null;
	});

	return client;
}

export function disconnectMqttClient(): void {
	if (client) {
		client.end();
		client = null;
		console.log("🔌 MQTT client disconnected");
	}
}
