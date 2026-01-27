/**
 * Skill Loader - Load Claude Skills
 */

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "yaml";
import { SkillSchema } from "./types.js";
import type { Skill } from "./types.js";

/**
 * Skill Loader
 *
 * Discovers and loads skills from SKILL.md files
 */
export class SkillLoader {
  private skillsDir: string;
  private loadedSkills: Map<string, Skill>;

  constructor(skillsDir: string = "./skills") {
    this.skillsDir = skillsDir;
    this.loadedSkills = new Map();
  }

  /**
   * Extract YAML frontmatter and body from SKILL.md content.
   *
   * Uses string operations to find content between "---" delimiters.
   *
   * @param content - Full content of SKILL.md file
   * @returns Object with frontmatterText and body, or null if not found
   * @throws None - Returns null on failure instead of throwing
   */
  private extractFrontmatter(
    content: string,
  ): { frontmatterText: string; body: string } | null {
    const firstDivider = content.indexOf("---\n");
    if (firstDivider === -1) return null;

    const secondDivider = content.indexOf("\n---\n", firstDivider + 4);
    if (secondDivider === -1) return null;

    return {
      frontmatterText: content.substring(firstDivider + 4, secondDivider),
      body: content.substring(secondDivider + 5),
    };
  }

  /**
   * Load and parse a single skill from a SKILL.md file.
   *
   * Flow:
   * - Read SKILL.md and extract frontmatter/body
   * - Parse YAML frontmatter
   * - Validate with Zod schema
   * - Convert relative paths to absolute paths
   *
   * @param skillPath - Absolute path to SKILL.md file
   * @returns Valid Skill object, or null if loading fails
   * @throws None - Errors are logged to console, returns null
   */
  loadSkill(skillPath: string): Skill | null {
    try {
      const content = fs.readFileSync(skillPath, "utf-8");

      const extracted = this.extractFrontmatter(content);
      if (!extracted) {
        console.warn(`⚠️  ${skillPath} missing valid frontmatter`);
        return null;
      }

      const { frontmatterText, body } = extracted;

      let frontmatter: any;
      try {
        frontmatter = yaml.parse(frontmatterText);
      } catch (error) {
        console.error(`❌ Failed to parse YAML: ${error}`);
        return null;
      }

      const validated = SkillSchema.safeParse(frontmatter);
      if (!validated.success) {
        console.error(`❌ Skill validation failed`);
        return null;
      }

      const skillDir = path.dirname(skillPath);

      const processedContent = this.processSkillPaths(body, skillDir);

      const skill: Skill = {
        ...validated.data,
        content: processedContent,
        skillPath,
      };

      return skill;
    } catch (error) {
      console.error(`❌ Failed to load skill (${skillPath}): ${error}`);
      return null;
    }
  }

  /**
   * Convert relative file paths to absolute paths in skill content.
   *
   * Handles three patterns:
   * 1. Directory paths: scripts/, examples/, templates/, reference/
   * 2. Direct docs: see file.md, read file.txt
   * 3. Markdown links: [text](path)
   *
   * @param content - Skill content with relative paths
   * @param skillDir - Absolute path of skill directory
   * @returns Processed content with absolute paths
   * @throws None - Returns original content if paths don't exist
   */
  private processSkillPaths(content: string, skillDir: string): string {
    const patternDirs =
      /(python\s+|`)((?:scripts|examples|templates|reference)\/[^\s`\)]+)/g;
    content = content.replace(patternDirs, (match, prefix, relPath) => {
      const absPath = path.resolve(skillDir, relPath);
      if (fs.existsSync(absPath)) {
        return `${prefix}${absPath}`;
      }
      return match;
    });

    const patternDocs =
      /(see|read|refer to|check)\s+([a-zA-Z0-9_-]+\.(?:md|txt|json|yaml))([.,;\s])/gi;
    content = content.replace(
      patternDocs,
      (match, prefix, filename, suffix) => {
        const absPath = path.resolve(skillDir, filename);
        if (fs.existsSync(absPath)) {
          return `${prefix}\`${absPath}\` (use read_file to access)${suffix}`;
        }
        return match;
      },
    );

    const patternMarkdown =
      /(?:(Read|See|Check|Refer to|Load|View)\s+)?\[(`?[^`\]]+`?)\]\(((?:\.)?[^)]+\.(?:md|txt|json|yaml|js|py|html))\)/gi;
    content = content.replace(
      patternMarkdown,
      (match, prefix, linkText, filepath) => {
        const cleanPath = filepath.startsWith("./")
          ? filepath.slice(2)
          : filepath;
        const absPath = path.resolve(skillDir, cleanPath);
        if (fs.existsSync(absPath)) {
          const effectivePrefix = prefix || "";
          return `${effectivePrefix}[${linkText}](\`${absPath}\`) (use read_file to access)`;
        }
        return match;
      },
    );

    return content;
  }

  /**
   * Recursively discover and load all skills from skills directory.
   *
   * Flow:
   * - Recursively find all SKILL.md files
   * - Load each skill with loadSkill()
   * - Check for duplicate names, skip if found
   * - Store in internal cache
   *
   * @returns Array of loaded Skill objects
   * @throws None - Silently skips invalid skills and duplicates
   */
  discoverSkills(): Skill[] {
    const skills: Skill[] = [];

    if (!fs.existsSync(this.skillsDir)) {
      console.warn(`⚠️  Skills directory does not exist: ${this.skillsDir}`);
      return skills;
    }

    // find SKILL.md recursively
    const findSkillFiles = (dir: string): string[] => {
      const skillFiles: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          skillFiles.push(...findSkillFiles(fullPath));
        } else if (entry.name === "SKILL.md") {
          skillFiles.push(fullPath);
        }
      }

      return skillFiles;
    };

    const skillFiles = findSkillFiles(this.skillsDir);

    //
    for (const skillFile of skillFiles) {
      const skill = this.loadSkill(skillFile);
      if (skill) {
        // Check duplicate skill
        if (this.loadedSkills.has(skill.name)) {
          console.warn(
            `⚠️  Duplicate skill name detected: '${skill.name}'. Using first occurrence.`,
          );
          continue;
        }
        skills.push(skill);
        this.loadedSkills.set(skill.name, skill);
      }
    }

    console.log(`✅ Discovered ${skills.length} Claude Skills`);
    return skills;
  }

  /**
   * Retrieve a loaded skill by name from internal cache.
   *
   * @param name - Skill name to retrieve
   * @returns Skill object if found, undefined otherwise
   * @throws None - Returns undefined if not found
   */
  getSkill(name: string): Skill | undefined {
    return this.loadedSkills.get(name);
  }

  /**
   * Get list of all loaded skill names.
   *
   * @returns Array of skill name strings
   */
  listSkills(): string[] {
    return Array.from(this.loadedSkills.keys());
  }

  /**
   * Generate metadata prompt for all loaded skills.
   *
   * Format: Lists each skill name and description for system prompt.
   *
   * @returns Formatted metadata string, or empty string if no skills
   */
  getSkillsMetadataPrompt(): string {
    if (this.loadedSkills.size === 0) {
      return "";
    }

    const promptParts: string[] = [];
    promptParts.push("## Available Skills\n");
    promptParts.push(
      "You have access to specialized skills. Each skill provides expert guidance for specific tasks.\n",
    );
    promptParts.push(
      "Load a skill's full content using get_skill tool when needed.\n",
    );

    for (const skill of this.loadedSkills.values()) {
      promptParts.push(`- \`${skill.name}\`: ${skill.description}`);
    }

    return promptParts.join("\n");
  }
}
