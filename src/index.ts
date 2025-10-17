import { ENV } from "@/constants/env";
import { disconnectFromDb } from "@/database";
import { startDataIngestion } from "@/modules/receive-and-process-data";
import { disconnectMqttClient } from "@/providers/broker";
async function main() {
	console.log("🚀 Initializing application...");

	await startDataIngestion();

	Bun.serve({
		port: ENV.PORT,
		fetch(req) {
			const url = new URL(req.url);
			if (url.pathname === "/health") {
				return new Response(JSON.stringify({ status: "ok" }), {
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response("Service is running.", { status: 200 });
		},
	});

	console.log(`\n✨ Application is running!`);
	console.log(`👂 MQTT data ingestion service is active.`);
	console.log(`✅ HTTP server is listening on http://localhost:${ENV.PORT}`);
	console.log("   Press Ctrl+C to exit.");
}

async function gracefulShutdown() {
	console.log("\n🛑 Shutting down gracefully...");
	await disconnectFromDb();
	disconnectMqttClient();
	process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

main().catch((error) => {
	console.error("💥 Unhandled fatal error during application startup:", error);
	process.exit(1);
});
