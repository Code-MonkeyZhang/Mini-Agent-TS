---
name: template-skill
description: A template skill for creating new skills. Use this skill as a starting point when you want to create your own specialized skill.
---

# Template Skill

This is a template skill that demonstrates the structure of a Mini-Agent skill.

## When to Use This Skill

Use this skill as a reference when creating new skills. It provides the basic structure and explains the key components.

## Skill Structure

A skill consists of:

1. **SKILL.md** - The main entry point with YAML frontmatter
2. **scripts/** - Optional directory for executable scripts
3. **references/** - Optional directory for reference documentation
4. **assets/** - Optional directory for assets (templates, icons, etc.)

## Creating a New Skill

1. Copy this template folder
2. Rename the folder to your skill name (kebab-case)
3. Update SKILL.md with your skill's name and description
4. Add your skill content

## Example

```markdown
---
name: my-new-skill
description: Description of what my skill does
---

# My New Skill

Your skill content here...
```
