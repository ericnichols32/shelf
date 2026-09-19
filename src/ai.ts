// Asking Gemini to read a photo or a shop page.
//
// This goes through Firebase AI Logic on the collection's own Firebase project,
// using Google's free tier for the Gemini Developer API. The project is on the
// no-cost Spark plan with no card attached, so there is nothing to be billed:
// past the free allowance a request is simply refused. No key lives in the
// site — Firebase holds it — and nothing here is needed to *view* the shelves.
//
// Everything is asked for as JSON against a fixed shape, so an answer is
// either usable as it stands or rejected, never half-parsed.

import type { ObjectSchema } from 'firebase/ai'
import { cloudConfigured } from './backend/config'

export const aiConfigured = cloudConfigured

/**
 * Newest first. Google retires model names over time; when one stops
 * answering, the next is tried, so the site keeps working until this list is
 * updated.
 */
const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']

export type Part = string | { mimeType: string; data: string }

export class AiUnavailable extends Error {}

let working: string | null = null

export async function askJson<T>(parts: Part[], schema: (s: typeof import('firebase/ai').Schema) => ObjectSchema): Promise<T> {
  if (!aiConfigured) throw new AiUnavailable('No Firebase project is set up.')
  const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = await import('firebase/ai')
  const { firebaseApp } = await import('./backend/app')
  const ai = getAI(firebaseApp(), { backend: new GoogleAIBackend() })

  const content = parts.map((p) =>
    typeof p === 'string' ? { text: p } : { inlineData: { mimeType: p.mimeType, data: p.data } },
  )

  let lastError: unknown
  for (const model of working ? [working, ...MODELS.filter((m) => m !== working)] : MODELS) {
    try {
      const m = getGenerativeModel(ai, {
        model,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema(Schema),
          temperature: 0,
        },
      })
      const result = await m.generateContent(content)
      working = model
      return JSON.parse(result.response.text()) as T
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err
      // Retired, busy, or out of its own free allowance — each model has a
      // separate one — so the next is worth asking.
      lastError = err
    }
  }
  const message = String((lastError as Error)?.message ?? lastError)
  // Every error names the service's address, so match the wording, not that.
  if (/requires the Firebase AI API|has not been used|is disabled|PERMISSION_DENIED/i.test(message)) {
    throw new AiUnavailable('Photo reading isn’t switched on in Firebase yet.')
  }
  if (/quota|429|RESOURCE_EXHAUSTED/i.test(message)) {
    throw new AiUnavailable('Gemini’s free allowance is used up for today.')
  }
  throw new AiUnavailable('Gemini didn’t answer.')
}

/** A photo, shrunk and turned into the form Gemini takes. */
export async function photoPart(file: Blob, longest = 1280): Promise<Part> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return { mimeType: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) }
}
