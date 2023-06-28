import { Reader, Writer } from "../stream"
export { Reader, Writer }

// This is OBJECT but we can't use that name because it's a reserved word.

// NOTE: This is forked from moq-transport-00.
//   1. messages lack a specified length
//   2. OBJECT must be the only message on a unidirectional stream

export interface Header {
	track: bigint
	group: bigint
	sequence: bigint
	send_order: bigint
	// followed by payload
}

export interface Payload {
	buffer: Uint8Array // unread buffered data
	reader: ReadableStream // unread unbuffered data
}

export class Transport {
	private quic: WebTransport

	constructor(quic: WebTransport) {
		this.quic = quic
	}

	async recv(): Promise<[Header, Reader] | undefined> {
		const streams = this.quic.incomingUnidirectionalStreams.getReader()

		const result = await streams.read()
		streams.releaseLock()

		if (result.done) return

		const reader = new Reader(result.value)
		const header = await decode_header(reader)

		return [header, reader]
	}

	async send(header: Header): Promise<Writer> {
		const stream = await this.quic.createUnidirectionalStream()

		// TODO use send_order when suppotred
		const writer = new Writer(stream)
		await encode_header(writer, header)

		return writer
	}
}

async function decode_header(r: Reader): Promise<Header> {
	const type = await r.vint52()
	if (type !== 0) throw new Error(`OBJECT type must be 0, got ${type}`)

	const track = await r.vint62()
	const group = await r.vint62()
	const sequence = await r.vint62()
	const send_order = await r.vint62()

	return {
		track,
		group,
		sequence,
		send_order,
	}
}

async function encode_header(w: Writer, h: Header) {
	await w.vint52(0)
	await w.vint62(h.track)
	await w.vint62(h.group)
	await w.vint62(h.sequence)
	await w.vint62(h.send_order)
}