import { ENV } from '@/constants/env'
import { connect } from 'mqtt'
import path from 'node:path'

console.log('🚀 Iniciando gerador de teste')

let simulationInterval: Timer | null = null

const options = {
  host: ENV.MQTT_BROKER_URL,
  port: ENV.MQTT_PORT,
  username: ENV.MQTT_USERNAME,
  password: ENV.MQTT_PASSWORD,
  protocol: 'mqtts' as const,
}

const client = connect(options)

client.on('connect', () => {
  console.log('✅ Conectado ao broker MQTT!')
})

client.on('error', (err) => {
  console.error('❌ Erro de conexão MQTT:', err)
  client.end()
})

Bun.serve({
  port: 4445,
  async fetch(req, server) {
    console.log(`✅ Conetado ao Gaia Server em: ${ENV.GAIA_SERVER_URL}`)

    const url = new URL(req.url)
    if (url.pathname === '/ws') {
      const success = server.upgrade(req)
      if (success) {
        return
      }
      return new Response('Falha ao fazer upgrade para WebSocket', {
        status: 500,
      })
    }

    if (url.pathname === '/stations' && req.method === 'GET') {
      const upstreamUrl = new URL(`${ENV.GAIA_SERVER_URL}/telemetry/stations`)
      upstreamUrl.search = url.search

      try {
        const response = await fetch(upstreamUrl)
        const body = await response.text()

        return new Response(body, {
          status: response.status,
          headers: {
            'content-type': response.headers.get('content-type') ?? 'application/json',
          },
        })
      } catch (error) {
        console.error('❌ Erro ao buscar estações:', error)
        return new Response(JSON.stringify({ message: 'Erro ao buscar estações.' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      }
    }

    if (url.pathname === '/') {
      const indexPath = path.join(import.meta.dir, '../test-generator/public/index.html')
      return new Response(Bun.file(indexPath))
    }
    const filePath = url.pathname === '/' ? './public/index.html' : url.pathname
    const fullPath = path.join(import.meta.dir, '../test-generator/public', filePath)
    const file = Bun.file(fullPath)

    if (await file.exists()) {
      return new Response(file)
    }

    if (server.upgrade(req)) {
      return
    }

    return new Response('Página não encontrada', { status: 404 })
  },
  websocket: {
    open(ws) {
      console.log('🔌 Cliente WebSocket conectado!')
      ws.send(
        JSON.stringify({
          type: 'info',
          message: 'Conexão estabelecida com o servidor.',
        }),
      )
    },
    message(ws, message) {
      const data = JSON.parse(message.toString())

      if (data.action === 'start') {
        console.log('▶ Iniciando simulação...')
        if (simulationInterval) clearInterval(simulationInterval)
        simulationInterval = setInterval(() => {
          const selectedStations = data.payload.stations
          const basePayload = data.payload.params
          selectedStations.forEach((stationId: string) => {
            const payload = {
              ...basePayload,
              uid: stationId,
              uxt: Math.floor(Date.now() / 1000),
            }
            const topic = 'readings'
            const msg = JSON.stringify(payload)
            if (client.connected) {
              client.publish(topic, msg)
              ws.send(JSON.stringify({ type: 'log', message: `[${topic}] ${msg}` }))
            }
          })
        }, 5000)
        ws.send(JSON.stringify({ type: 'status', message: 'Simulação iniciada.' }))
      }

      if (data.action === 'stop') {
        console.log('⏹ Parando simulação...')
        if (simulationInterval) {
          clearInterval(simulationInterval)
          simulationInterval = null
        }
        ws.send(JSON.stringify({ type: 'status', message: 'Simulação parada.' }))
      }
    },
    close(ws) {
      console.log('🔌 Cliente WebSocket desconectado.')
      if (simulationInterval) {
        clearInterval(simulationInterval)
        simulationInterval = null
      }
    },
  },
  error() {
    return new Response('Ocorreu um erro', { status: 500 })
  },
})

console.log('✅ Servidor rodando em http://localhost:4445')
