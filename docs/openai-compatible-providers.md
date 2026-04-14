# OpenAI-Compatible Provider Routing

CCS can route Claude Code traffic through a local Anthropic-compatible proxy when
your API profile points at an OpenAI-compatible chat completions endpoint.

This is useful for providers such as:

- Hugging Face Inference Providers
- OpenRouter
- Ollama
- llama.cpp servers
- OpenAI-compatible self-hosted gateways

## What CCS Does

When you launch a compatible settings profile with the Claude target, CCS now:

1. Starts a local proxy on `127.0.0.1`
2. Accepts Anthropic `/v1/messages` traffic from Claude Code
3. Translates requests into OpenAI chat-completions format
4. Forwards them to your configured upstream provider
5. Translates streaming responses back into Anthropic SSE

You do not need to rewrite your profile by hand each time.

## Quick Start

Create or reuse an API profile that points at an OpenAI-compatible endpoint:

```bash
ccs api create --preset hf
```

Then you can use the profile directly:

```bash
ccs hf
```

CCS detects that the profile is OpenAI-compatible and auto-routes Claude Code
through the local proxy.

## Manual Proxy Lifecycle

If you want to manage the proxy explicitly:

```bash
ccs proxy start hf
eval "$(ccs proxy activate)"
ccs proxy status
ccs proxy stop
```

`ccs proxy activate` prints the `ANTHROPIC_*` exports needed for a local
Anthropic-compatible session against the running proxy.

## One Active Proxy Profile

The current runtime is a single local proxy daemon.

- Reusing the same OpenAI-compatible profile is supported
- Starting a different OpenAI-compatible profile while one proxy is already
  running is rejected instead of silently replacing the active upstream

This is intentional to avoid breaking an in-flight Claude session by swapping
its upstream provider out from under it.

## How Profile Detection Works

CCS keeps these profiles in the normal API/settings-profile flow.

Anthropic-compatible endpoints such as:

- `https://api.anthropic.com`
- `https://api.z.ai/api/anthropic`
- `https://api.deepseek.com/anthropic`

continue to launch directly.

OpenAI-compatible endpoints such as:

- `https://router.huggingface.co/v1`
- `https://api.openai.com/v1`
- `http://localhost:11434`

are routed through the local proxy for Claude-target launches.

## Self-Signed TLS

If your upstream gateway uses a self-signed or privately issued certificate,
set this in the profile settings JSON:

```json
{
  "env": {
    "CCS_OPENAI_PROXY_INSECURE": "1"
  }
}
```

That flag is respected by both:

- `ccs <profile>` auto-routing
- `ccs proxy start <profile>`

## Supported Runtime Paths

- `ccs <profile>` with Claude target: auto-starts the local proxy when needed
- `ccs proxy start <profile>`: starts the proxy explicitly
- `GET /health`: proxy liveness check
- `GET /v1/models`: local view of the configured model mapping
- `POST /v1/messages`: Anthropic-compatible request entrypoint

## Validation

The shipped coverage includes:

- unit tests for OpenAI-compatible profile detection
- unit tests for Anthropic -> OpenAI request translation
- unit tests for multi-line SSE parsing
- integration tests for `/v1/messages` request/response translation
- integration tests for daemon lifecycle and `/health` / `/v1/models`
- e2e tests for `ccs proxy` lifecycle
- e2e tests for `ccs <profile>` auto-routing through a mock upstream

## Current Scope

The current implementation focuses on the core routing path:

- local proxy lifecycle
- Anthropic/OpenAI request-response translation
- Claude-target settings profile auto-routing

Scenario-based routing and token-count-driven model switching remain follow-up
work if they are needed beyond the base provider-routing flow.
