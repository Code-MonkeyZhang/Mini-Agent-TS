/**
 * Skill types and interfaces
 */

import { z } from 'zod'

/**
 * Skill Schema for validation
 */
export const SkillSchema = z.object({
  name: z.string().refine(val => val.length > 0, 'Skill name is required'),
  description: z.string().refine(val => val.length > 0, 'Skill description is required'),
  license: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

export type Skill = z.infer<typeof SkillSchema> & {
  content: string
  skillPath?: string
}