import { ENV } from '@/constants/env'
import { disconnectFromDb } from '@/database'
import { startDataIngestion } from '@/modules/receive-and-process-data'
import { disconnectMqttClient } from '@/providers/broker'
import {
  proxyStationsRequest,
  serveTestGeneratorAsset,
  testGeneratorWebSocketHandlers,
} from '@/modules/test-generator/server'
async function main() {
  console.log('🚀 Initializing application...')

  await startDataIngestion()

  Bun.serve({
    port: ENV.PORT,
    async fetch(req, server) {
      const url = new URL(req.url)
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.pathname === '/stations' && req.method === 'GET') {
        return proxyStationsRequest(url)
      }

      if (url.pathname === '/ws' || url.pathname === '/test/ws') {
        const upgraded = server.upgrade(req)
        if (upgraded) {
          return
        }

        return new Response('Falha ao fazer upgrade para WebSocket', { status: 500 })
      }

      const assetResponse = await serveTestGeneratorAsset(url.pathname)
      if (assetResponse) {
        return assetResponse
      }

      if (url.pathname === '/test' || url.pathname.startsWith('/test/')) {
        return new Response('Arquivo não encontrado', { status: 404 })
      }

      return new Response('Service is running.', { status: 200 })
    },
    websocket: testGeneratorWebSocketHandlers,
  })

  console.log('\n✨ Application is running!')
  console.log('👂 MQTT data ingestion service is active.')
  console.log(`✅ HTTP server is listening on port:${ENV.PORT}`)
  console.log('   Press Ctrl+C to exit.')
}

async function gracefulShutdown() {
  console.log('\n🛑 Shutting down gracefully...')
  await disconnectFromDb()
  disconnectMqttClient()
  process.exit(0)
}

process.on('SIGINT', (SIGINT) => {
  console.log('SIGINT', SIGINT)
  gracefulShutdown()
})
process.on('SIGTERM', (SIGTERM) => {
  console.log('SIGTERM', SIGTERM)
  gracefulShutdown()
})

main().catch((error) => {
  console.error('💥 Unhandled fatal error during application startup:', error)
  process.exit(1)
})
