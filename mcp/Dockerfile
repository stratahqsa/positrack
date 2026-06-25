# Positrack MCP server — Railway-ready container.
# BUILD FROM THE REPO ROOT (the image needs core/ alongside mcp/):
#   docker build -f mcp/Dockerfile -t positrack-mcp .
FROM python:3.11-slim

WORKDIR /app

# Dependencies first for layer caching.
COPY mcp/requirements.txt /app/mcp/requirements.txt
RUN pip install --no-cache-dir -r /app/mcp/requirements.txt

# The shared engine + the server (engine must sit at /app/core for the import).
COPY core/ /app/core/
COPY mcp/ /app/mcp/

# Dual transport (streamable HTTP /mcp + SSE /sse + /health). Railway injects $PORT.
ENV POSITRACK_TRANSPORT=dual \
    HOST=0.0.0.0 \
    PORT=8000 \
    PYTHONUNBUFFERED=1
# YT_BASE may be overridden; tokens are NEVER baked in — they ride per-request.
ENV YT_BASE=https://support.posibolt.com

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/health',timeout=4)" || exit 1

CMD ["python", "/app/mcp/server.py"]
