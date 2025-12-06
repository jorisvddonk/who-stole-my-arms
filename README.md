# Who stole my arms!?

A programmable, wacky, LLM-driven, accurate, dice-supporting roleplaying game inspired by D&D and Paranoia. Built with a Bun backend and Lit web components frontend.

## Features

- **LLM Integration**: Uses Koboldcpp for AI-powered text generation
- **Chat Interface**: Interactive chat UI for roleplaying
- **Toolbox Menu**: Extensible menu system for game tools and features
- **Dice Support**: (Planned) Integrated dice rolling mechanics
- **Programmable**: Extensible architecture for custom game mechanics

## Prerequisites

- [Bun](https://bun.sh/) installed
- Koboldcpp running locally on port 5001 (default)

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

Open `http://localhost:3000` in your browser to access the game interface. Use the chat to interact with the AI-powered game master, and access tools via the toolbox menu.

### API Endpoints

- `POST /generate`: Generate text with the LLM
  ```json
  {
    "prompt": "Your prompt here"
  }
  ```

- `GET /metrics`: Get system metrics

## Architecture

- **Backend**: Bun server with TypeScript
- **Frontend**: Lit web components, no build step
- **LLM**: Koboldcpp integration via REST API
- **Tools**: Modular widget system for extensibility