import { ENV } from '@/constants/env'
import { getMqttClient } from '@/providers/broker'
import type { ServerWebSocket } from 'bun'
import path from 'node:path'

type SimulationInterval = ReturnType<typeof setInterval>

const PUBLIC_DIR = path.resolve(import.meta.dir, '../../../test-generator/public')
const ENTRY_POINTS = ['/test', '/test/']
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
}
const WEB_SOCKET_INTERVAL_MS = 5_000

const simulationIntervals = new WeakMap<ServerWebSocket, SimulationInterval>()

function safeJoin(relativePath: string): string | null {
  if (!relativePath) {
    return null
  }

  const normalized = path.normalize(relativePath)

  if (normalized.startsWith('..')) {
    return null
  }

  return path.join(PUBLIC_DIR, normalized)
}

function resolveStaticPath(pathname: string): string | null {
  if (ENTRY_POINTS.includes(pathname)) {
    return path.join(PUBLIC_DIR, 'index.html')
  }

  if (pathname.startsWith('/test/')) {
    const relative = pathname.replace('/test/', '')
    return safeJoin(relative)
  }

  if (!pathname.startsWith('/')) {
    return null
  }

  const relative = pathname.slice(1)
  return safeJoin(relative)
}

export async function serveTestGeneratorAsset(
  pathname: string,
): Promise<Response | null> {
  const fullPath = resolveStaticPath(pathname)

  if (!fullPath) {
    return null
  }

  const file = Bun.file(fullPath)

  if (!(await file.exists())) {
    return null
  }

  const ext = path.extname(fullPath).toLowerCase()
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'

  return new Response(file, {
    headers: {
      'Content-Type': contentType,
    },
  })
}

export async function proxyStationsRequest(url: URL): Promise<Response> {
  const upstreamUrl = new URL(`${ENV.GAIA_SERVER_URL}/telemetry/stations`)
  upstreamUrl.search = url.search

  try {
    const response = await fetch(upstreamUrl)
    const body = await response.text()

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/json',
      },
    })
  } catch (error) {
    console.error('❌ Failed to fetch stations list:', error)
    return new Response(JSON.stringify({ message: 'Erro ao buscar estações.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

function clearSimulation(ws: ServerWebSocket): void {
  const interval = simulationIntervals.get(ws)

  if (interval) {
    clearInterval(interval)
    simulationIntervals.delete(ws)
  }
}

function sendStatus(ws: ServerWebSocket, message: string): void {
  ws.send(
    JSON.stringify({
      type: 'status',
      message,
    }),
  )
}

function sendLog(ws: ServerWebSocket, message: string): void {
  ws.send(
    JSON.stringify({
      type: 'log',
      message,
    }),
  )
}

type SimulationMessage = {
  action: 'start' | 'stop'
  payload?: { stations?: string[]; params?: Record<string, unknown> }
}

function toText(message: string | ArrayBuffer | Uint8Array): string {
  if (typeof message === 'string') {
    return message
  }

  if (message instanceof ArrayBuffer) {
    return Buffer.from(message).toString('utf-8')
  }

  return Buffer.from(message).toString('utf-8')
}

function startSimulation(
  ws: ServerWebSocket,
  payload: NonNullable<SimulationMessage['payload']>,
): void {
  const mqttClient = getMqttClient()
  const stations = Array.isArray(payload.stations) ? payload.stations : []
  const params = payload.params ?? {}

  if (stations.length === 0) {
    sendStatus(ws, 'Nenhuma estação selecionada.')
    return
  }

  clearSimulation(ws)

  const sanitizedParams = Object.fromEntries(
    Object.entries(params)
      .map(([key, value]) => [key, Number(value)] as const)
      .filter(([, value]) => Number.isFinite(value)),
  )

  const topic = ENV.MQTT_TOPIC

  const interval = setInterval(() => {
    if (!mqttClient.connected) {
      sendStatus(ws, 'Cliente MQTT desconectado.')
      clearSimulation(ws)
      return
    }

    stations.forEach((stationIdRaw) => {
      const stationId = String(stationIdRaw)
      const message = JSON.stringify({
        ...sanitizedParams,
        uid: stationId,
        uxt: Math.floor(Date.now() / 1000),
      })

      mqttClient.publish(topic, message)
      sendLog(ws, `[${topic}] ${message}`)
    })
  }, WEB_SOCKET_INTERVAL_MS)

  simulationIntervals.set(ws, interval)
  sendStatus(ws, 'Simulação iniciada.')
}

export const testGeneratorWebSocketHandlers = {
  open(ws: ServerWebSocket) {
    console.log('🔌 Test generator client connected')
    ws.send(
      JSON.stringify({
        type: 'info',
        message: 'Conexão estabelecida com o servidor.',
      }),
    )
  },
  message(ws: ServerWebSocket, message: string | ArrayBuffer | Uint8Array) {
    try {
      const parsed = JSON.parse(toText(message)) as SimulationMessage

      if (parsed.action === 'start') {
        startSimulation(ws, parsed.payload ?? {})
        return
      }

      if (parsed.action === 'stop') {
        clearSimulation(ws)
        sendStatus(ws, 'Simulação parada.')
        return
      }

      sendStatus(ws, 'Ação desconhecida.')
    } catch (error) {
      console.error('❌ Invalid message received on test generator websocket:', error)
      sendStatus(ws, 'Payload inválido recebido.')
    }
  },
  close(ws: ServerWebSocket) {
    console.log('🔌 Test generator client disconnected.')
    clearSimulation(ws)
  },
}
