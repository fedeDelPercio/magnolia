/**
 * Helper compartido para llamadas al LLM que extraen datos estructurados
 * (JSON validado contra un schema Zod) desde un archivo — PDF o imagen.
 *
 * Soporta dos proveedores, seleccionables por env var:
 *   LLM_PROVIDER=anthropic   → llama directo al API de Anthropic (default)
 *   LLM_PROVIDER=openrouter  → llama via OpenRouter (mismo modelo Claude)
 *
 * Env vars requeridas segun el proveedor:
 *   Anthropic:  ANTHROPIC_API_KEY
 *   OpenRouter: OPENROUTER_API_KEY
 *
 * Ambos usan modelos Claude. La abstraccion existe porque Anthropic direct
 * tiene mejor soporte de PDFs/vision con structured outputs (messages.parse
 * + zodOutputFormat) pero OpenRouter tiene billing internacional mas flexible
 * (acepta pagos que Anthropic direct no).
 */

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

type Provider = 'anthropic' | 'openrouter'
type ModelTier = 'sonnet' | 'opus'

// Mapping de tier logico -> model ID por proveedor. Si Anthropic o OpenRouter
// renombran/versionan modelos, actualizar aca. Los IDs de OpenRouter usan
// prefijo "anthropic/" y version corta con puntos (ej. "claude-sonnet-4.5").
const MODELS: Record<Provider, Record<ModelTier, string>> = {
  anthropic:  { sonnet: 'claude-sonnet-4-6',           opus: 'claude-opus-4-7' },
  openrouter: { sonnet: 'anthropic/claude-sonnet-4.6', opus: 'anthropic/claude-opus-4.7' },
}

function currentProvider(): Provider {
  return process.env.LLM_PROVIDER === 'openrouter' ? 'openrouter' : 'anthropic'
}

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export type ExtractOptions<T extends z.ZodType> = {
  fileBytes: Buffer
  mimeType: string                  // 'application/pdf' | 'image/jpeg' | 'image/png' | ...
  systemPrompt: string
  userPrompt: string
  schema: T
  modelTier: ModelTier
  maxTokens: number
  // Nombre semantico para el JSON schema. OpenRouter lo requiere;
  // Anthropic direct lo ignora (pero es util para logs/debug).
  schemaName: string
}

export type ExtractResult<T> = {
  data?: T
  error?: string
  rawResponse?: unknown
}

export async function extractStructuredFromFile<T extends z.ZodType>(
  opts: ExtractOptions<T>,
): Promise<ExtractResult<z.infer<T>>> {
  const provider = currentProvider()
  const model = MODELS[provider][opts.modelTier]

  const isPdf = opts.mimeType === 'application/pdf'
  const isImage = IMAGE_MIMES.has(opts.mimeType)
  if (opts.mimeType === 'image/heic' || opts.mimeType === 'image/heif') {
    return { error: 'HEIC/HEIF no es soportado por el modelo. Convertí a JPG o PNG.' }
  }
  if (!isPdf && !isImage) return { error: `Tipo de archivo no soportado: ${opts.mimeType}` }

  try {
    if (provider === 'openrouter') return await extractViaOpenRouter(opts, model)
    return await extractViaAnthropic(opts, model)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido al llamar a la IA' }
  }
}

// -------- Anthropic direct --------

async function extractViaAnthropic<T extends z.ZodType>(
  opts: ExtractOptions<T>,
  model: string,
): Promise<ExtractResult<z.infer<T>>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: 'ANTHROPIC_API_KEY no configurada' }

  const base64 = opts.fileBytes.toString('base64')
  const client = new Anthropic({ apiKey })

  const content = opts.mimeType === 'application/pdf'
    ? [
        { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } },
        { type: 'text' as const, text: opts.userPrompt },
      ]
    : [
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: opts.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data: base64,
          },
        },
        { type: 'text' as const, text: opts.userPrompt },
      ]

  const response = await client.messages.parse({
    model,
    max_tokens: opts.maxTokens,
    system: opts.systemPrompt,
    messages: [{ role: 'user', content }],
    output_config: { format: zodOutputFormat(opts.schema) },
  })

  if (!response.parsed_output) return { error: 'La IA no pudo extraer datos', rawResponse: response }
  return { data: response.parsed_output as z.infer<T>, rawResponse: response }
}

// -------- OpenRouter (OpenAI-compat + extensiones) --------

async function extractViaOpenRouter<T extends z.ZodType>(
  opts: ExtractOptions<T>,
  model: string,
): Promise<ExtractResult<z.infer<T>>> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return { error: 'OPENROUTER_API_KEY no configurada' }

  const base64 = opts.fileBytes.toString('base64')
  const dataUrl = `data:${opts.mimeType};base64,${base64}`

  // OpenRouter: content blocks son OpenAI-style (image_url) + una extension
  // propia para archivos (type: 'file' con file_data como data URL).
  const content = opts.mimeType === 'application/pdf'
    ? [
        { type: 'file' as const, file: { filename: 'file.pdf', file_data: dataUrl } },
        { type: 'text' as const, text: opts.userPrompt },
      ]
    : [
        { type: 'image_url' as const, image_url: { url: dataUrl } },
        { type: 'text' as const, text: opts.userPrompt },
      ]

  // Zod v4 tiene z.toJSONSchema built-in. OpenRouter espera JSON Schema
  // estandar bajo response_format.json_schema.schema (con strict:true fuerza
  // al modelo a devolver JSON que valide contra el schema).
  // Sanitizamos: strict mode (OpenAI/Anthropic-via-OpenRouter) rechaza
  // keywords como `minimum`, `maximum`, `pattern`, `format`. Los sacamos del
  // JSON schema porque igual validamos con Zod al volver — no perdemos nada.
  const jsonSchema = stripUnsupportedKeywords(z.toJSONSchema(opts.schema))

  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: opts.schemaName, strict: true, schema: jsonSchema },
    },
  }
  if (opts.mimeType === 'application/pdf') {
    // Fuerza a Claude a usar su PDF parsing nativo (sin OCR previo). Es lo
    // que queremos — Claude Sonnet/Opus leen PDFs directamente y no
    // queremos pagar tokens extra de un preprocesamiento OCR.
    body.plugins = [{ id: 'file-parser', pdf: { engine: 'native' } }]
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // OpenRouter recomienda estos headers para tracking (opcional).
      'HTTP-Referer': 'https://magnolia.vercel.app',
      'X-Title': 'Magnolia',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    return { error: `OpenRouter ${res.status}: ${errText.slice(0, 400)}` }
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
    error?: { message: string }
  }

  if (json.error) return { error: `OpenRouter: ${json.error.message}` }
  const text = json.choices?.[0]?.message?.content
  if (!text) return { error: 'OpenRouter no devolvio contenido', rawResponse: json }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'OpenRouter devolvio contenido no-JSON', rawResponse: json }
  }

  const result = opts.schema.safeParse(parsed)
  if (!result.success) {
    return { error: `Schema validation fallo: ${result.error.message}`, rawResponse: json }
  }
  return { data: result.data as z.infer<T>, rawResponse: json }
}

// Strict structured-outputs (OpenAI y Anthropic-via-OpenRouter) rechazan
// varios keywords de JSON Schema. Los sacamos recursivamente. La validacion
// de rangos/patrones sigue vigente porque despues corremos Zod.safeParse.
const UNSUPPORTED_KEYWORDS = new Set([
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'minLength', 'maxLength', 'pattern',
  'minItems', 'maxItems', 'uniqueItems',
  'minProperties', 'maxProperties',
  'format',
])

function stripUnsupportedKeywords(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupportedKeywords)
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (UNSUPPORTED_KEYWORDS.has(k)) continue
      out[k] = stripUnsupportedKeywords(v)
    }
    return out
  }
  return node
}
