[English](./README.md) | [中文](./README_CN.md)

# Mini-Agent (TypeScript 版) 快速启动指南

> 本项目是 Minimax 开源的[Mini-Agent](https://github.com/MiniMax-AI/Mini-Agent) 项目的 TypeScript 实现版本。

这是一个可以在你的终端（命令行）中运行的 AI 智能体，它能帮你读写文件、执行系统命令。

## 🛠️ 第一步：安装 Node.js

请根据你的系统，复制对应的命令在终端（Terminal / PowerShell）中运行：

- **Windows** (PowerShell):
  ```powershell
  winget install -e --id OpenJS.NodeJS.LTS
  ```
- **Mac** (需 Homebrew):
  ```bash
  brew install node
  ```
- **Linux** (Ubuntu/Debian):
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs
  ```

_(安装完成后，请关闭并重新打开终端，输入 `node -v`。如果看到类似 `v20.x.x` 的字样，说明成功。)_

## 📥 第二步：下载代码

在终端中执行以下命令将项目克隆到本地：

```bash
# 1. 克隆仓库
https://github.com/Code-MonkeyZhang/Mini-Agent-TS.git
# 2. 进入项目目录
cd Mini-Agent/Mini-Agent-TS
```

_(如果你的电脑没有安装 Git，Windows 用户可以运行 `winget install Git.Git`，Mac 用户运行 `brew install git`)_

## ⚙️ 第三步：安装与链接

在终端中依次执行以下两条命令，这会将 `mini-agent-ts` 命令注册到你的系统中：

```bash
# 1. 安装依赖
npm install

# 2. 编译并链接到系统命令
npm run build && npm link
```

## 🔑 第四步：配置 API Key

你需要告诉 AI 你的身份凭证。

1. 进入项目文件夹下的 `config` 目录。
2. 将 `config-example.yaml` 复制一份并重命名为 `config.yaml`：
   ```bash
   cp config/config-example.yaml config/config.yaml
   ```
3. 用记事本或代码编辑器打开 `config.yaml`，修改以下关键配置：

```yaml
# config/config.yaml

# 填入你的 API Key
api_key: "YOUR_API_KEY_HERE" # 替换为你的 MiniMax API Key

# API 地址（根据你的网络环境选择）
api_base: "https://api.minimax.io/anthropic" # 海外用户
# api_base: "https://api.minimaxi.com"        # 国内用户

# 模型和提供商
model: "MiniMax-M2"
provider: "anthropic"

# 日志配置（可选）
enableLogging: false # 设置为 true 以启用文件日志，日志将保存在项目根目录的 logs/ 文件夹下
```

## 🚀 第五步：运行

一切就绪！现在你可以在终端的**任何位置**直接输入命令来启动。

### 1. 基础运行

默认在当前目录启动：

```bash
mini-agent-ts
```

### 2. 指定工作空间 (Workspace)

你可以让 Agent 在特定目录下工作，这样它创建的文件都会保存在那里，不会弄乱你的当前文件夹：

```bash
# Windows
mini-agent-ts --workspace D:\MyProjects\TestAgent

# Mac / Linux
mini-agent-ts -w ./my-workspace
```

你会看到欢迎界面 `🤖 Mini Agent`。现在你可以像和人聊天一样给它下达指令了，例如：

> "请帮我在当前目录下创建一个名为 hello.txt 的文件，里面写一首关于程序员的诗。"

---

## 🎯 Agent 技能 (Beta)

Mini-Agent 支持 **Agent 技能** - 模块化、自包含的包，通过专业知识、工作流程和工具扩展 Claude 的能力。

### 启用技能

技能默认已启用。如有需要，你可以在 `config.yaml` 中配置：

```yaml
tools:
  enableSkills: true
  skillsDir: "./skills"  # 技能目录路径
```

### 创建技能目录

在你的项目中或指定位置创建一个 `skills` 目录：

```bash
# 创建 skills 目录
mkdir skills

# 创建你的第一个技能
mkdir skills/my-skill
```

### 技能结构

每个技能必须包含一个带有 YAML 前置元数据的 `SKILL.md` 文件：

```
skills/my-skill/
└── SKILL.md  # 必需 - 技能入口点
```

### SKILL.md 格式

```markdown
---
name: my-skill
description: 技能的简短描述，说明技能用途和使用场景
---

# 技能标题

你的技能内容...
```

### 可用技能

当你的 skills 目录中有技能时，Mini-Agent 会：

1. **发现** 所有技能（自动扫描）
2. **注入** 技能名称和描述到系统提示词
3. **加载** 当你调用 `get_skill` 工具时获取完整技能内容

使用 `get_skill` 工具加载技能的完整内容：

```
你 > 我需要帮助创建一个 Dockerfile

Agent > 让我加载 dockerfile-builder 技能...
[Agent 调用 get_skill 工具]

Assistant > # Skill: dockerfile-builder

[完整的技能内容现在对 Agent 可见]
```

### 示例技能

你可以在 [`skills-example`](./skills-example/) 目录中找到示例技能。

---

## 👨‍💻 开发者指南

如果你想参与开发或调试代码，可以使用以下命令：

| 命令            | 作用                                                                                      |
| :-------------- | :---------------------------------------------------------------------------------------- |
| `npm run build` | **编译项目**：将 TypeScript 源代码编译为 JavaScript (输出到 `dist/` 目录)。               |
| `npm run dev`   | **开发模式运行**：使用 `tsx` 直接运行源代码，无需手动编译，修改代码后即刻生效，适合调试。 |
| `npm run start` | **生产模式运行**：运行编译后的代码 (需要先执行 build)。                                   |
| `npm test`      | **运行测试**：执行 Vitest 单元测试。                                                      |

