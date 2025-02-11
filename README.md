```markdown
# Firecrawl Deep Research

A unified setup combining [Open Deep Research](https://github.com/dzhng/open-deep-research) and [Firecrawl](https://github.com/mendableai/firecrawl), plus SearxNG, Redis, and a front-end web GUI.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Environment Variables](#environment-variables)
5. [Installation & Quick Start](#installation--quick-start)
6. [Usage](#usage)
7. [Original Project Credits](#original-project-credits)
8. [Troubleshooting](#troubleshooting)
9. [License](#license)

---

## Overview

**Deep Research**: An AI-powered iterative research assistant that searches online and uses LLMs to produce detailed reports.

**Firecrawl**: A self-hostable scraping/orchestration tool that powers advanced website scraping, transformations, and queue-based tasks.

**SearxNG**: A meta-search engine for gathering external results.

**Redis**: In-memory data store for caching and job queues.

**Front-End Web GUI**: A React-based chat interface that interacts with Deep-Research for a ChatGPT-like user experience.

---

## Architecture

```mermaid
flowchart LR
    subgraph Docker Network (backend)
      subgraph Deep Research
        DR[Deep-Research Container]
      end
      subgraph Firecrawl
        FC_API[Firecrawl API (3002)]
        FC_WORKER[Firecrawl Worker]
        PW[Playwright Service (3000)]
      end
      SNG[SearxNG (8080)]
      RDS[Redis]
      FE[Front-End (React)]
    end

    DR -- uses --> FC_API
    DR -- uses --> SNG
    FC_API -- tasks --> FC_WORKER
    FC_API -- scraping --> PW
    FC_API -- caching --> RDS
    FE -- queries --> DR
```

- **Deep-Research** runs on port `3001`, calling Firecrawl and SearxNG.
- **Firecrawl** has an API (port `3002`), Worker, and Playwright Service.
- **SearxNG** runs internally at `http://searxng:8080`.
- **Redis** is internal at `redis://redis:6379`.
- **Front-end** is exposed on `http://localhost:8081`.

---

## Prerequisites

1. **Docker** & **Docker Compose** installed.
2. A `.env` file with environment variables (see below).
3. Sufficient memory/CPU to run multiple containers.

---

## Environment Variables

Below is an example `.env` you can use as a template. Copy or rename it to `.env` in the root directory and adjust values as needed:

```ini
# ========================
# Deep-Research Variables
# ========================
FIRECRAWL_KEY=
FIRECRAWL_BASE_URL=http://api:3002
FIRECRAWL_BASE_URL_SCRAPE=http://api:3002/v1/scrape
OPENAI_KEY=ollama
OPENAI_ENDPOINT=http://localhost:11434/v1
SEARXNG_BASE_URL=http://searxng:8080
MODEL=deepseek-r1:14b

# ========================
# Firecrawl Variables
# ========================
NUM_WORKERS_PER_QUEUE=8
PORT=3002
HOST=0.0.0.0
REDIS_URL=redis://redis:6379
REDIS_RATE_LIMIT_URL=redis://redis:6379
USE_DB_AUTHENTICATION=false

# ========================
# Supabase Setup
# ========================
SUPABASE_ANON_TOKEN=
SUPABASE_URL=
SUPABASE_SERVICE_TOKEN=

# ========================
# API Keys & Credentials
# ========================
TEST_API_KEY=
SCRAPING_BEE_API_KEY=
OPENAI_API_KEY=
BULL_AUTH_KEY=
PLAYWRIGHT_MICROSERVICE_URL=http://playwright-service:3000
LLAMAPARSE_API_KEY=
SLACK_WEBHOOK_URL=
POSTHOG_API_KEY=
POSTHOG_HOST=

# ========================
# Logging & Monitoring
# ========================
SELF_HOSTED_WEBHOOK_URL=
LOGGING_LEVEL=
LOGTAIL_KEY=

# ========================
# Proxy Configuration (If Needed)
# ========================
PROXY_SERVER=
PROXY_USERNAME=
PROXY_PASSWORD=
BLOCK_MEDIA=

# ========================
# Additional Model Configuration
# ========================
OPENAI_BASE_URL=
MODEL_NAME=

# ========================
# Docker Networking
# ========================
DOCKER_BUILDKIT=1
COMPOSE_DOCKER_CLI_BUILD=1
```

- **Deep-Research** typically needs `FIRECRAWL_BASE_URL`, `FIRECRAWL_BASE_URL_SCRAPE`, `OPENAI_KEY`, etc.
- **Firecrawl** needs `REDIS_URL`, `PLAYWRIGHT_MICROSERVICE_URL`, etc.
- **SearxNG** is internal, no host port by default.
- **Frontend** typically references `REACT_APP_API_BASE_URL` to talk to Deep-Research.

## Installation & Quick Start

1. **Clone the repo**:
   ```bash
   git clone https://github.com/mrelgie88/deep-research-firecrawl
   cd firecrawl-deep-research
   ```

2. **Create/Edit `.env`**:
   ```bash
   FIRECRAWL_BASE_URL=http://api:3002
   FIRECRAWL_BASE_URL_SCRAPE=http://api:3002/v1/scrape
   OPENAI_KEY=YOUR_OPENAI_KEY
   # ...
   REACT_APP_API_BASE_URL=http://deep-research:3001
   ```

3. **Run Docker Compose**:
   ```bash
   docker compose up --build -d
   ```
   - This launches all containers (Deep-Research, Firecrawl, SearxNG, Redis, and the Front-End).

4. **Verify**:
   - Visit [http://localhost:8081] for the front-end.
   - Deep-Research is at `[HOST_IP]:3001`, Firecrawl API at `[HOST_IP]:3002`.

---

## Usage

### Front-End Web GUI
- Accessible at `http://localhost:8081`.
- Sends user queries to Deep-Research (`http://deep-research:3001`).

### Deep-Research
- Port `3001`.
- Takes a user query, performs iterative research using Firecrawl & SearxNG, and produces a final report.

### Firecrawl (API & Worker)
- The API is at `http://localhost:3002`.
- Worker processes tasks in the background.
- For advanced usage (PDF parsing, LLM calls, etc.), see Firecrawl docs.

### SearxNG
- Internal: `http://searxng:8080`.
- Provides meta-search capability for Deep-Research.

### Redis
- Internal: `redis://redis:6379`.
- Shared caching & job queue.

---

## Original Project Credits

### Open Deep Research
- [Repo](https://github.com/dzhng/open-deep-research) by [@dzhng](https://x.com/dzhng)
- MIT License

### Firecrawl
- [Repo](https://github.com/mendableai/firecrawl) by Mendable
- Self-hosting instructions, advanced scraping
- Licensed under terms specified in [Mendable/Firecrawl licensing](https://github.com/mendableai/firecrawl/blob/main/LICENSE)

### SearxNG
- [Repo](https://github.com/searxng/searxng)
- AGPLv3 license

---

## Troubleshooting

1. **Blank Front-End**:
   - Check browser DevTools → Console for errors.
   - Confirm `REACT_APP_API_BASE_URL` is correct.
2. **Deep-Research Not Responding**:
   - `docker compose logs deep-research`
   - Ensure `FIRECRAWL_KEY`, `OPENAI_KEY` set.
3. **Firecrawl Fails**:
   - `docker compose logs api` or `worker`
   - Confirm `REDIS_URL` is correct.
4. **SearxNG Not Providing Results**:
   - `docker compose logs searxng`
   - By default, it’s only on Docker network.
5. **Port Conflicts**:
   - If `8080` or `3001/3002` are in use, change them in `docker-compose.yml`.

---

## License

- **Open Deep Research**: MIT License
- **Firecrawl**: See [Mendable/Firecrawl licensing](https://github.com/mendableai/firecrawl/blob/main/LICENSE)
- **SearxNG**: AGPLv3
- Other libraries carry their own licenses.

Enjoy exploring advanced, self-hosted AI research & scraping! If you have issues, check logs:
```bash
docker compose logs <service_name>
```
```
