import { describe, it, expect } from 'vitest'
import { cleanVTT } from '../../src/fetchers/youtube.js'

describe('cleanVTT', () => {
  it('removes WEBVTT header', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHallo Welt'
    expect(cleanVTT(vtt)).not.toContain('WEBVTT')
  })

  it('removes timestamp lines', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHallo Welt'
    const result = cleanVTT(vtt)
    expect(result).not.toMatch(/\d{2}:\d{2}/)
    expect(result).toContain('Hallo Welt')
  })

  it('removes Kind: and Language: metadata lines', () => {
    const vtt = 'WEBVTT\nKind: subtitles\nLanguage: de\n\n00:00:01.000 --> 00:00:03.000\nText hier'
    const result = cleanVTT(vtt)
    expect(result).not.toContain('Kind:')
    expect(result).not.toContain('Language:')
  })

  it('removes NOTE blocks', () => {
    const vtt = 'WEBVTT\n\nNOTE This is a note\n\n00:00:01.000 --> 00:00:03.000\nRezept'
    expect(cleanVTT(vtt)).not.toContain('NOTE')
    expect(cleanVTT(vtt)).toContain('Rezept')
  })

  it('strips HTML tags from subtitle text', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<c.colorE5E5E5>Hallo</c>'
    expect(cleanVTT(vtt)).toBe('Hallo')
  })

  it('deduplicates consecutive identical lines', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHallo\n\n00:00:02.000 --> 00:00:03.000\nHallo\n\n00:00:03.000 --> 00:00:04.000\nWelt'
    const result = cleanVTT(vtt)
    // "Hallo" should appear only once, "Welt" once
    const words = result.split(' ')
    const halloCount = words.filter(w => w === 'Hallo').length
    expect(halloCount).toBe(1)
    expect(result).toContain('Welt')
  })

  it('returns empty string for empty VTT', () => {
    expect(cleanVTT('WEBVTT\n\n')).toBe('')
  })

  it('joins multiple lines with space', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nEins\n\n00:00:02.000 --> 00:00:03.000\nZwei'
    expect(cleanVTT(vtt)).toBe('Eins Zwei')
  })

  it('handles a realistic VTT snippet', () => {
    const vtt = [
      'WEBVTT',
      'Kind: subtitles',
      'Language: de',
      '',
      '00:00:00.500 --> 00:00:03.000',
      'Heute machen wir ein leckeres Rezept.',
      '',
      '00:00:03.000 --> 00:00:05.000',
      'Heute machen wir ein leckeres Rezept.',
      '',
      '00:00:05.000 --> 00:00:08.000',
      'Wir brauchen 200g Mehl und 2 Eier.',
    ].join('\n')
    const result = cleanVTT(vtt)
    expect(result).toContain('Heute machen wir ein leckeres Rezept.')
    expect(result).toContain('Wir brauchen 200g Mehl und 2 Eier.')
    // deduped: only one occurrence of the first line
    const occurrences = result.split('Heute machen wir ein leckeres Rezept.').length - 1
    expect(occurrences).toBe(1)
  })
})
