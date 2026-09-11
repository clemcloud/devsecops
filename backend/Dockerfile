# ---- Build stage ----
FROM python:3.12-slim-bookworm AS build

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
# ---- Production stage ----
FROM python:3.12-slim-bookworm AS production

# Create a dedicated non-root system user to run the app
RUN addgroup --system --gid 1000 appgroup && adduser --system --uid 1000 --ingroup appgroup appuser

# Install dumb-init for correct PID 1 signal handling, then clean up apt cache to reduce image size
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init=1.2.5-3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only the installed dependencies from the build stage (not pip's cache/build tools)
COPY --from=build /root/.local /home/appuser/.local

# Copy application code
COPY app/ ./app/

# Ensure the non-root user owns everything it needs to run
RUN chown -R appuser:appgroup /app /home/appuser/.local

USER appuser

# Fix: explicitly set HOME so Python correctly resolves user-site packages
ENV HOME=/home/appuser
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONPATH=/home/appuser/.local/lib/python3.12/site-packages

EXPOSE 8000

ENTRYPOINT ["dumb-init", "--"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]