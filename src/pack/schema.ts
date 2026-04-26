import { z } from 'zod'

// ─── Style ───────────────────────────────────────────────────────────────────

export const StyleSchema = z.object({
  frontmatter: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
  }).optional().default({}),
  blocks: z.array(z.object({ name: z.string(), body: z.string() })),
  notes: z.string().optional(),
})
export type Style = z.infer<typeof StyleSchema>

// ─── Storyboard frontmatter ───────────────────────────────────────────────────

export const StoryboardFrontmatterSchema = z.object({
  title: z.string(),
  slug: z.string(),
  active_provider: z.enum(['seedream', 'openai-image', 'gemini-image', 'imagen', 'openrouter', 'seedance', 'veo-3', 'kling']),
  active_model: z.string().optional(),
  variations_default: z.number().int().min(1).max(8).default(1),
  budget_project: z.number().nonnegative(),
  budget_currency: z.literal('GBP').default('GBP'),
  style_ref: z.string().optional(),
  concurrency: z.record(z.string(), z.number().int().min(1).max(16)).optional(),
})
export type StoryboardFrontmatter = z.infer<typeof StoryboardFrontmatterSchema>

export const FrontmatterSchema = StoryboardFrontmatterSchema
export type Frontmatter = StoryboardFrontmatter

// ─── Block ────────────────────────────────────────────────────────────────────

export const BlockSchema = z.object({ name: z.string(), body: z.string() })
export type Block = z.infer<typeof BlockSchema>

// ─── Shot ─────────────────────────────────────────────────────────────────────

export const ShotSchema = z.object({
  slug: z.string(),
  camera: z.string().optional(),
  lens: z.string().optional(),
  aspect: z.string().optional(),
  action: z.string(),
  refs: z.array(z.string()).default([]),
  styleBlocks: z.array(z.string()).default([]),
  negBlocks: z.array(z.string()).default([]),
  provider: z.string().optional(),
  model: z.string().optional(),
  resolution: z.string().optional(),
  variations: z.number().int().min(1).max(8).optional(),
  video_mode: z.enum(['i2v', 't2v']).optional(),
  duration_sec: z.number().int().positive().optional(),
  motion: z.number().min(0).max(1).optional(),
  start_frame: z.string().optional(),
  end_frame: z.string().optional(),
  audio: z.boolean().optional(),
})
export type Shot = z.infer<typeof ShotSchema>

// ─── Pack (merged in-memory shape) ───────────────────────────────────────────

export const PackSchema = z.object({
  frontmatter: FrontmatterSchema,
  blocks: z.array(BlockSchema),
  shots: z.array(ShotSchema),
})
export type Pack = z.infer<typeof PackSchema>

// ─── JSON Schema exports (for Gemini structured output — Phase 1D) ────────────

export const ShotJsonSchema = z.toJSONSchema(ShotSchema)
export const PackJsonSchema = z.toJSONSchema(PackSchema)

// ─── Validation helper ────────────────────────────────────────────────────────

/**
 * Parse arbitrary input through PackSchema. Throws Zod error on
 * mismatch. Used by parseStoryboard / parseStyle / buildPack on
 * their output to catch silent format drift.
 */
export function validatePack(input: unknown): Pack {
  return PackSchema.parse(input)
}
