import { describe, it, expect } from 'vitest'
import { toChatId, unwrap, getQrImage, buildEventsUrl } from '../openwa'

describe('toChatId', () => {
  it('converts leading 0 to 62', () => {
    expect(toChatId('0812345678')).toBe('62812345678@c.us')
  })

  it('keeps existing 62 prefix', () => {
    expect(toChatId('62812345678')).toBe('62812345678@c.us')
  })

  it('strips +, spaces and dashes', () => {
    expect(toChatId('+62 812-3456-78')).toBe('62812345678@c.us')
  })
})

describe('unwrap', () => {
  it('returns .data when wrapped', () => {
    expect(unwrap({ success: true, data: { id: 'x' } })).toEqual({ id: 'x' })
  })

  it('returns body as-is when not wrapped', () => {
    expect(unwrap({ id: 'x' })).toEqual({ id: 'x' })
  })
})

describe('getQrImage', () => {
  it('reads data.image from wrapped response', () => {
    expect(getQrImage({ data: { image: 'data:image/png;base64,AAA' } })).toBe(
      'data:image/png;base64,AAA',
    )
  })

  it('reads qr field from raw response', () => {
    expect(getQrImage({ qr: 'data:image/png;base64,BBB' })).toBe('data:image/png;base64,BBB')
  })

  it('returns empty string when no qr present', () => {
    expect(getQrImage({ data: {} })).toBe('')
  })
})

describe('buildEventsUrl', () => {
  it('builds an SSE url with encoded id and apiKey', () => {
    expect(buildEventsUrl('my session', 'owa_abc')).toBe(
      '/api/sessions/my%20session/events?apiKey=owa_abc',
    )
  })
})
