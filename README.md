[English](./README.md) | [中文](./README_CN.md)

# Mini-Agent (TypeScript Edition) Quick Start Guide

> This project is a TypeScript implementation of Minimax's open-source [Mini-Agent](https://github.com/MiniMax-AI/Mini-Agent) project.

This is an AI agent that runs in your terminal (command line), capable of helping you read/write files and execute system commands.

## 🛠️ Step 1: Install Node.js

Run the appropriate command for your system in Terminal/PowerShell:

- **Windows** (PowerShell):
  ```powershell
  winget install -e --id OpenJS.NodeJS.LTS
  ```
- **Mac** (requires Homebrew):
  ```bash
  brew install node
  ```
- **Linux** (Ubuntu/Debian):
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs
  ```

_(After installation, close and reopen your terminal, then type `node -v`. If you see something like `v20.x.x`, it's successful.)_

## 📥 Step 2: Download the Code

Run these commands in your terminal to clone the project locally:

```bash
# 1. Clone repository
https://github.com/Code-MonkeyZhang/Mini-Agent-TS.git
# 2. Enter project directory
cd Mini-Agent/Mini-Agent-Tस
```

_(If Git isn't installed: Windows users can run `winget install Git.Git`, Mac users run `brew install git`)_

## ⚙️ Step 3: Install & Link

Run these two commands sequentially to register `mini-agent-ts` as a system command:

```bash
# 1. Install dependencies
npm install

# 2. Build and link to system commands
npm run build && npm link
```

## 🔑 Step 4: Configure API Key

You need to provide AI with your credentials.

1. Navigate to the `config` folder in the project directory.
2. Copy `config-example.yaml` and rename it to `config.yaml`:
   ```bash
   cp config/config-example.yaml config/config.yaml
   ```
3. Open `config.yaml` with a text/code editor and modify these key configurations:

```yaml
# config/config.yaml

# Enter your API Key
api_key: "YOUR_API_KEY_HERE" # Replace with your MiniMax API Key

# API endpoint (choose based on network environment)
api_base: "https://api.minimax.io/anthropic" # Overseas users
# api_base: "https://api.minimaxi.com"        # Mainland China users

# Model and provider
model: "MiniMax-M2"
provider: "anthropic"

# Logging (optional)
enableLogging: false # Set to true to enable file logging (logs saved in logs/ folder at project root)
```

## 🚀 Step 5: Run

Ready to go! You can now launch it from anywhere in your terminal.

### 1. Basic Operation

Launch in current directory:

```bash
mini-agent-ts
```

### 2. Specify Workspace

Have Agent work in a specific directory to keep generated files organized:

```bash
# Windows
mini-agent-ts --workspace D:\MyProjects\TestAgent

# Mac / Linux
mini-agent-ts -w ./my-workspace
```

You'll see the welcome screen `🤖 Mini Agent`. Now give instructions conversationally, e.g.:

> "Please create a file named hello.txt in the current directory containing a poem about programmers."

---

## 🎯 Agent Skills (Beta)

Mini-Agent supports **Agent Skills** - modular, self-contained packages that extend Claude's capabilities with specialized knowledge, workflows, and tools.

### Enable Skills

Skills are enabled by default. If needed, you can configure skills in `config.yaml`:

```yaml
tools:
  enableSkills: true
  skillsDir: "./skills"  # Path to skills directory
```

### Create Skills Directory

Create a `skills` directory in your project or anywhere you specify:

```bash
# Create skills directory
mkdir skills

# Create your first skill
mkdir skills/my-skill
```

### Skill Structure

Each skill must contain a `SKILL.md` file with YAML frontmatter:

```
skills/my-skill/
└── SKILL.md  # Required - skill entry point
```

### SKILL.md Format

```markdown
---
name: my-skill
description: A brief description of what this skill does and when to use it
---

# Skill Title

Your skill content here...
```

### Available Skills

When you have skills in the skills directory, Mini-Agent will:

1. **Discover** all skills automatically
2. **Inject** skill names and descriptions into the system prompt
3. **Load** full skill content when you call the `get_skill` tool

Use the `get_skill` tool to load a skill's full content:

```
You > I need help creating a Dockerfile

Agent > Let me load the dockerfile-builder skill...
[Agent calls get_skill tool]

Assistant > # Skill: dockerfile-builder

[Full skill content is now available to the agent]
```

### Example Skills

You can find example skills in the [`skills-example`](./skills-example/) directory.

---

## 👨‍💻 Developer Guide

For development/debugging, use these commands:

| Command         | Purpose                                                                                     |
| :-------------- | :------------------------------------------------------------------------------------------ |
| `npm run build` | **Compile project**: Transpiles TypeScript to JavaScript (outputs to `dist/`).              |
| `npm run dev`   | **Development mode**: Runs source directly via `tsx` with hot-reloading for debugging.      |
| `npm run start` | **Production mode**: Runs compiled code (requires prior `build` execution).                 |
| `npm test`      | **Run tests**: Executes Vitest unit tests.                                                  |