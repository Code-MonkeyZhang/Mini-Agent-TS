/**
 * GetSkillTool - Tool for Agent to load Skills on-demand
 */

import type { Tool, ToolInput, ToolResult } from '../tools/base.js'
import type { SkillLoader } from './skill-loader.js'

/**
 * GetSkillTool
 * 
 * Tool to get detailed information about a specific skill
 */
export class GetSkillTool implements Tool {
  name = 'get_skill'
  description = 'Get complete content and guidance for a specified skill, used for executing specific types of tasks'
  parameters = {
    type: 'object',
    properties: {
      skill_name: {
        type: 'string',
        description: 'Name of skill to retrieve'
      }
    },
    required: ['skill_name']
  }

  constructor(private skillLoader: SkillLoader) { }

  /**
   * Execute the get_skill tool to retrieve a skill's full content.
   *
   * Flow:
   * 1. Validate skill_name parameter exists
   * 2. Retrieve skill from SkillLoader
   * 3. Return formatted skill content | error
   *
   * @param params - Tool parameters with skill_name
   * @returns ToolResult with success/content or error
   * @throws None - Returns error in ToolResult instead of throwing
   */
  async execute(params: ToolInput): Promise<ToolResult> {
    const skillName = params['skill_name'] as string

    if (!skillName) {
      return {
        success: false,
        content: '',
        error: 'Missing required parameter: skill_name'
      }
    }

    const skill = this.skillLoader.getSkill(skillName)

    if (!skill) {
      const available = this.skillLoader.listSkills().join(', ')
      return {
        success: false,
        content: '',
        error: `Skill '${skillName}' does not exist. Available skills: ${available}`
      }
    }

    const content = this.formatSkillAsPrompt(skill)

    return {
      success: true,
      content
    }
  }

  /**
   * Format a Skill object into a standardized prompt string.
   *
   * Format:
   * # Skill: {name}
   * {description}
   * ---
   * {content}
   *
   * @param skill - Skill object with name, description, content
   * @returns Formatted markdown string for agent consumption
   */
  private formatSkillAsPrompt(skill: { name: string; description: string; content: string }): string {
    return `# Skill: ${skill.name}

${skill.description}

---

${skill.content}`
  }
}
