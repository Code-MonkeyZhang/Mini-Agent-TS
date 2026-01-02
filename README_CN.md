[English](./README.md) | [中文](./README_CN.md)

# Mini-Agent (TypeScript版) 快速启动指南

这是一个可以在你的终端（命令行）中运行的 AI 智能体，它能帮你读写文件、执行系统命令。

## 🛠️ 第一步：安装 Node.js

请根据你的系统，复制对应的命令在终端（Terminal / PowerShell）中运行：

*   **Windows** (PowerShell):
    ```powershell
    winget install -e --id OpenJS.NodeJS.LTS
    ```
*   **Mac** (需 Homebrew):
    ```bash
    brew install node
    ```
*   **Linux** (Ubuntu/Debian):
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs
    ```

*(安装完成后，请关闭并重新打开终端，输入 `node -v`。如果看到类似 `v20.x.x` 的字样，说明成功。)*

## 📥 第二步：下载代码

在终端中执行以下命令将项目克隆到本地：

```bash
# 1. 克隆仓库
git clone https://github.com/YourUsername/Mini-Agent.git

# 2. 进入项目目录
cd Mini-Agent/Mini-Agent-TS
```

*(如果你的电脑没有安装 Git，Windows 用户可以运行 `winget install Git.Git`，Mac 用户运行 `brew install git`)*

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

1.  在项目文件夹下的 `config` 目录中，找到（或新建）一个名为 `config.yaml` 的文件。
2.  用记事本或代码编辑器打开它，填入以下内容：

```yaml
# config/config.yaml

# 1. 在这里填入你的 API Key (MiniMax 或 OpenAI 格式)
api_key: "sk-xxxxxxxxxxxxxxxxxxxxxxxx"

# 2. 设置模型和提供商
# 如果使用 MiniMax:
model: "MiniMax-Text-01"  # 或其他 MiniMax 模型名
provider: "openai"        # MiniMax 兼容 OpenAI 协议
api_base: "https://api.minimax.io/v1"
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

## 👨‍💻 开发者指南

如果你想参与开发或调试代码，可以使用以下命令：

| 命令 | 作用 |
| :--- | :--- |
| `npm run build` | **编译项目**：将 TypeScript 源代码编译为 JavaScript (输出到 `dist/` 目录)。 |
| `npm run dev` | **开发模式运行**：使用 `tsx` 直接运行源代码，无需手动编译，修改代码后即刻生效，适合调试。 |
| `npm run start` | **生产模式运行**：运行编译后的代码 (需要先执行 build)。 |
| `npm test` | **运行测试**：执行 Vitest 单元测试。 |
