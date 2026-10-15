# Haishin

Premium AI workspace by **Haitian (H-Y-C-E-A-N)**.

> **v0.1 — Frontend Demo.** All responses are pre-written mock data. No trained model is running. This is the interface foundation for the Haishin AI platform.

---

## Prerequisites

| Tool    | Version  |
|---------|----------|
| Node.js | ≥ 20 LTS |
| npm     | ≥ 10     |
| Git     | ≥ 2.40   |

## Quick Start

```bash
# 1. Clone and enter the project
cd haishin

# 2. Install dependencies
npm install --ignore-scripts

# 3. Start development server
npm run dev

# 4. Open in browser
# → http://localhost:3000
```

## Available Commands

| Command           | Description                         |
|-------------------|-------------------------------------|
| `npm run dev`     | Start development server            |
| `npm run build`   | Create production build             |
| `npm start`       | Start production server             |
| `npm run lint`    | Run ESLint                          |

## Project Structure

```
haishin/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout with fonts + providers
│   │   ├── page.tsx            # Home page → AppShell
│   │   └── globals.css         # Design tokens + global styles
│   ├── components/
│   │   ├── layout/             # AppShell, Sidebar, TopBar, BrandMark
│   │   ├── chat/               # ChatView, MessageBubble, Composer, Welcome
│   │   ├── model/              # ModelSelector
│   │   └── ui/                 # Toast, ConfirmDialog
│   ├── features/
│   │   └── conversations/      # Types, state (useReducer), models registry
│   └── lib/                    # Demo responder, utilities
├── .env.example                # Template (no secrets committed)
├── package.json
├── tsconfig.json
└── README.md
```

## Architecture

### State Management

Conversations use a `useReducer` hook (`src/features/conversations/state.ts`) that manages:
- Creating / switching / deleting conversations
- Sending messages and receiving mock responses
- Stop-generation (AbortController)
- Retry last response
- Loading, error, and empty states

### Demo Responder

`src/lib/demo-responder.ts` returns pre-written responses with a simulated 0.8–2s delay. Every response carries `mode: "mock"` so the UI can label it honestly. This adapter will be replaced with a real API client in Phase 3.

### Response Adapter Interface

```typescript
interface ChatRequest {
  conversationId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  modelId: string;
}

interface ChatResponse {
  message: { role: "assistant"; content: string };
  mode: "mock" | "haishin" | "external";
}
```

Future backends implement this same shape.

## Features (v0.1)

- [x] Premium dark workspace (deep navy palette)
- [x] Sidebar with conversation history, new chat, settings
- [x] Collapsible sidebar / mobile drawer
- [x] Model selector (demo available, future models disabled)
- [x] Welcome screen with suggested prompts
- [x] Message bubbles with Markdown rendering (GFM)
- [x] Code block syntax display
- [x] Enter to send, Shift+Enter for newline, IME-aware
- [x] Copy message action with feedback
- [x] Retry last response
- [x] Stop generation (AbortController)
- [x] Loading spinner + error states
- [x] Confirm dialog for destructive actions
- [x] Toast notifications
- [x] Demo disclosure everywhere — no fake model claims
- [x] Responsive layout (mobile / tablet / desktop)
- [x] Accessible: semantic HTML, ARIA, keyboard, focus-visible, reduced-motion
- [x] Disabled attachment button ("Coming later")
- [x] Settings dialog (display-only for now)

## Known Limitations

- **No persistence:** conversations are in-memory only; refreshing clears them.
- **No real model:** all responses are pre-written mock content.
- **No backend:** no API, database, or authentication.
- **No tests yet:** unit tests will be added in Phase 2.
- **ESLint deprecation warning:** `eslint@9.x` is used by `create-next-app` scaffold — functional but shows a deprecation notice.

## Design Tokens

| Token          | Value     |
|----------------|-----------|
| Background     | `#0B0D12` |
| Sidebar        | `#10141C` |
| Surface        | `#151A23` |
| Border         | `#273040` |
| Primary text   | `#F3F5F9` |
| Secondary text | `#9AA6B8` |
| Accent         | `#8AB4F8` |

## Roadmap

1. **Phase 1** ✅ Frontend foundation (this milestone)
2. **Phase 2** — Frontend hardening: tests, localStorage, mobile polish
3. **Phase 3** — Backend skeleton (FastAPI + typed schemas)
4. **Phase 4** — Persistence + auth (PostgreSQL)
5. **Phase 5** — First model experiment (PyTorch)
6. **Phase 6** — Model improvement + evaluation
7. **Phase 7** — Release readiness

## License

Private — Haitian (H-Y-C-E-A-N). Not yet licensed for public distribution.
