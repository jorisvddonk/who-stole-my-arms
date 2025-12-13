# Who Stole My Arms!?

A programmable, wacky, LLM-driven roleplaying game application inspired by D&D and Paranoia. It provides an interactive chat interface for AI-powered roleplaying, with extensible tools and widgets for game mechanics. Built with a Bun backend and Lit web components frontend.

## Features

- **LLM Integration**: Connects to Koboldcpp for text generation with streaming support
- **Chat Interface**: Real-time conversation with the AI game master
- **Session Management**: Isolated game sessions with persistent chat history
- **Extensible Architecture**: Plugin system for tools (popup dialogs) and widgets (dock grid)
- **Prompt Management**: Template-based prompt building with providers
- **Modular Design**: Easy to add new tools and widgets

## Prerequisites

- [Bun](https://bun.sh/) installed
- Koboldcpp running locally on port 5001 (default)

## Environment Variables

- `WSMA_AGENT_SEARCH_PATH`: Semicolon-separated list of directories to search for additional agent files (e.g., `/path/to/agents;/another/path`). Each directory should contain TypeScript (.ts) or JavaScript (.js) files that export a default class extending `LLMAgent`. These agents will be dynamically loaded and made available in the application.
- `WSMA_SYSTEM_PROMPT_SEARCH_PATH`: Semicolon-separated list of directories to search for additional system prompt files. Each directory should contain JSON (.json) files defining prompt groups. The JSON structure should be an object where keys are group names and values are prompt group objects with `type: 'group'`, `name`, `description`, and `items` array containing prompt definitions.

## Installation

Clone or download this project.

## Starting the Server

Run the following command:

```bash
bun run index.ts
```

Or use the npm script:

```bash
npm start
```

The server will start on port 3000.

## Usage

### Web Interface

Open `http://localhost:3000` in your browser to access the game interface.

- **Chat**: Interact with the AI game master in real-time
- **Sessions**: Create and switch between isolated game sessions
- **Dock Widgets**: Add persistent widgets to the dock grid (e.g., OS Metrics)
- **Toolbox Menu**: Access popup tools for game mechanics and utilities

### API Endpoints

#### LLM Generation
- `POST /generate`: Generate text with the LLM
  ```json
  {
    "prompt": "Your prompt here"
  }
  ```
- `POST /generateStream`: Streaming text generation

#### Sessions
- `GET /sessions`: List all sessions
- `POST /sessions`: Create a new session
- `DELETE /sessions/:id`: Delete a session

#### Chat History
- `GET /sessions/:id/chat/messages`: Get chat messages for a session
- `POST /sessions/:id/chat/messages`: Add a message to chat history

#### Prompts
- `GET /sessions/:id/prompts/templates`: List prompt templates
- `POST /sessions/:id/prompts/templates`: Create a prompt template
- `GET /sessions/:id/prompts/build`: Build a prompt from templates

#### LLM Control
- `GET /llm/settings`: Get current LLM settings
- `POST /llm/settings`: Update LLM settings
- `GET /llm/info`: Get LLM model information
- `POST /llm/tokens`: Tokenize text
- `POST /llm/detokenize`: Detokenize tokens

#### Tools and Widgets
- `GET /toolbox/list`: List available toolbox tools
- `GET /widgets/list`: List available dock widgets

#### System Metrics
- `GET /metrics`: Get OS metrics (CPU, memory, etc.)

## CLI Tool

The `cli.ts` script provides a command-line interface for direct interaction with LLM agents, useful for testing, scripting, or headless usage.

### Features

- **Agent Selection**: Choose from available agents (ConversationalAgent, CombatAgent, etc.)
- **Prompt Input**: Provide prompts via command-line argument, stdin piping, or interactive input
- **Debug REPL**: Interactive debugging mode with task inspection and history
- **Streaming Output**: Real-time LLM response streaming with event logging

### Usage

Run the CLI tool:

```bash
bun run cli.ts [options]
```

### Options

- `--agent <name>`: Specify the agent to use (e.g., `--agent ConversationalAgent`)
- `--prompt <text>`: Set the user prompt text directly
- `--repl`: Start the debug REPL for interactive debugging
- `--debug`: Enable debug logging
- `--list-agents`: List available agents and exit

### Examples

**Interactive agent selection and prompt:**
```bash
bun run cli.ts
```

**Specify agent and prompt:**
```bash
bun run cli.ts --agent MathAgent --prompt "What is 2+2?"
```

**Pipe input from stdin:**
```bash
echo "Tell me a joke" | bun run cli.ts --agent ConversationalAgent
```

**Start debug REPL:**
```bash
bun run cli.ts --repl
```

**Debug mode with agent:**
```bash
bun run cli.ts --agent CombatAgent --debug --prompt "I attack the goblin"
```

The CLI tool connects to the same Koboldcpp instance as the web app and uses the same agent system for consistent behavior.

## Architecture

### Backend (TypeScript + Bun)

- **Server**: Bun.serve on port 3000 with custom routing
- **Database**: SQLite via Bun, with global and session-specific databases
- **Middleware**: Logging and storage injection for session-aware components
- **LLM API**: KoboldAPI class implementing streaming/non-streaming generation
- **Modular Design**: Tools and widgets implement interfaces for registration

### Frontend (Lit Web Components)

- **Main App**: `<chat-app>` component with top bar, chat history, and dock
- **Dock System**: Grid-based widget layout with resizable rows
- **Toolbox Menu**: Floating/inline menu for popup tools
- **Session Management**: Top bar with session switching
- **Styling**: CSS variables for consistent theming (brown/sepia color scheme)

### Tool and Widget Systems

#### Backend Tool System

Tools are implemented as classes that implement the `ToolboxTool` interface:

- **Interface**: `interfaces/ToolboxTool.ts` defines tools with a `getRoutes()` method returning API endpoints
- **Registration**: Tools register their frontend widget URLs with `ToolboxCollector` in their constructor
- **Server Integration**: In `index.ts`, tools are instantiated and their routes are merged into the Bun server
- **Discovery Endpoint**: `/toolbox/list` serves JSON array of registered tool widget URLs

**Example**: `lib/tools/os-metrics-tool.ts` provides `/metrics` API endpoint and registers `/widgets/os-metrics-widget.js`

#### Backend Widget System

Widgets are implemented as classes that implement the `DockWidget` interface:

- **Interface**: `interfaces/DockWidget.ts` defines widgets with a `getRoutes()` method returning API endpoints
- **Registration**: Widgets register their frontend widget URLs with `WidgetCollector` in their constructor
- **Server Integration**: In `index.ts`, widgets are instantiated and their routes are merged into the Bun server
- **Discovery Endpoint**: `/widgets/list` serves JSON array of registered widget URLs

**Example**: `lib/widgets/os-metrics-dock-widget.ts` provides `/metrics` API endpoint and registers `/widgets/os-metrics-dock-widget.js`

#### Frontend Tool System

Tools appear in the frontend through dynamic loading and registration:

- **Discovery**: `frontend/widgets/toolbox-menu.js` fetches `/toolbox/list` and imports each tool widget
- **Registration**: Widgets export a `register(toolboxMenu)` function that adds menu items
- **Display**: Tools appear as items in the floating toolbox menu, opening widgets in popup dialogs
- **Widget Pattern**: Each tool widget is a Web Component that can be opened in `popup-dialog`

**Example**: `frontend/widgets/os-metrics-widget.js` registers "OS Metrics" menu item that opens the widget

#### Frontend Widget System

Widgets appear in the dock's edit interface and can be added to grid rows:

- **Discovery**: `frontend/widgets/dock-widget.js` fetches `/widgets/list` and imports each widget
- **Registration**: Widgets export a `registerWidgetType(dockWidgetManager)` function that adds widget types to the available options
- **Display**: Widgets appear as options in the edit widgets popup and can be placed in the dock's grid layout
- **Widget Pattern**: Each widget is a Web Component that renders within the dock's grid system

**Example**: `frontend/widgets/os-metrics-dock-widget.js` registers "OS Metrics" widget type that displays system metrics

### Storage Injection

Storage injection automatically provides component storage in API handlers based on the request route.

- **Session-Aware Components**: For routes under `/sessions/sessionId/` or global routes with components implementing `HasStorage`, handlers receive isolated storage via `(req as any).context.get('storage')`, scoped to the component and session (or global if no session)

## Development

### Adding New Tools

1. Create a backend tool class implementing `ToolboxTool`
2. Register with `ToolboxCollector` in constructor
3. Create frontend widget as Web Component
4. Export `register(toolboxMenu)` function

### Adding New Widgets

1. Create a backend widget class implementing `DockWidget`
2. Register with `WidgetCollector` in constructor
3. Create frontend widget as Web Component
4. Export `registerWidgetType(dockWidgetManager)` function
