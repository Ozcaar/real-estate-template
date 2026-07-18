import { Readable } from 'node:stream'
import type { H3Event } from 'h3'

/**
 * Minimal mock H3Event for endpoint unit tests.
 *
 * The `POST /api/contact` endpoint reads from the event via h3's
 * helpers (`assertMethod`, `getHeader`, `getRequestIP`,
 * `readRawBody`) and writes via `setResponseStatus`,
 * `setResponseHeader`). Every property the endpoint actually reads
 * or writes is implemented here. Nothing else is.
 *
 * h3's `readRawBody` requires either `content-length` or
 * `transfer-encoding: chunked` to know there is a body to read.
 * Without one of these, it short-circuits to `undefined`. The
 * helper sets `content-length` from the actual byte length so the
 * mock matches what a real `IncomingMessage` would carry.
 *
 * h3's `getRequestIP` reads `socket.clientAddress` (with a
 * `remoteAddress` fallback). The mock sets both so either path
 * resolves.
 *
 * `readRawBody` consumes the request as a Node `Readable` stream,
 * so the body is provided as a `Readable.from([buffer])` stream
 * that emits `data` and `end` events on the next tick.
 *
 * Properties are attached with `Object.defineProperty` (not
 * `Object.assign` or property assignment) because `Readable`
 * objects can have inherited getters that shadow the assigned
 * values. `defineProperty` with `configurable: true` ensures the
 * own property always wins.
 *
 * The helper is deliberately small and local to the test
 * infrastructure. It is not exported from any other module.
 */

export interface MockEventOptions {
  method?: string
  headers?: Record<string, string>
  body?: string | Buffer
  ip?: string
}

export interface MockEventResult {
  event: H3Event
  /**
   * Read the captured response status and headers after the handler
   * returns. The body is whatever the handler returned (the
   * endpoint returns the JSON body directly).
   */
  getResponse: () => { status: number, headers: Record<string, string> }
}

export function makeH3Event(options: MockEventOptions = {}): MockEventResult {
  const method = options.method ?? 'POST'
  const reqHeaders: Record<string, string> = { ...(options.headers ?? {}) }
  const bodyBuf = options.body === undefined
    ? Buffer.alloc(0)
    : typeof options.body === 'string'
      ? Buffer.from(options.body, 'utf8')
      : options.body

  // h3's `readRawBody` requires either `content-length` or
  // `transfer-encoding: chunked` to know there is a body to read.
  if (bodyBuf.length > 0) {
    reqHeaders['content-length'] = String(bodyBuf.length)
  }

  // `readRawBody` listens for `data` and `end` events on the
  // request. `Readable.from([buffer])` emits the buffer on the
  // next tick and ends immediately, which is exactly the contract.
  const stream = Readable.from([bodyBuf])

  // Attach the mock properties with `defineProperty` so they always
  // win over any inherited getter on the `Readable` instance.
  const ip = options.ip ?? '127.0.0.1'
  Object.defineProperty(stream, 'method', { value: method, writable: true, configurable: true, enumerable: true })
  Object.defineProperty(stream, 'headers', { value: reqHeaders, writable: true, configurable: true, enumerable: true })
  Object.defineProperty(stream, 'socket', {
    value: { clientAddress: ip, remoteAddress: ip },
    writable: true,
    configurable: true,
    enumerable: true,
  })

  const resHeaders: Record<string, string> = {}
  const res = {
    statusCode: 200 as number,
    setHeader(name: string, value: string): void {
      resHeaders[name.toLowerCase()] = String(value)
    },
  }

  const event = {
    method,
    // h3's `getRequestIP` reads `event.context.clientAddress` first
    // (before falling back to `event.node.req.socket`). Provide it
    // here so the mock matches the real h3 event shape.
    context: { clientAddress: ip },
    node: { req: stream, res },
  } as unknown as H3Event

  return {
    event,
    getResponse: () => ({
      status: res.statusCode,
      headers: { ...resHeaders },
    }),
  }
}
