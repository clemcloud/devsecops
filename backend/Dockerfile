FROM python:3.12-slim-bookworm AS build

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim-bookworm AS production

RUN addgroup --system --gid 1000 appgroup && adduser --system --uid 1000 --ingroup appgroup appuser

RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /root/.local /home/appuser/.local

COPY app/ ./app/

RUN chown -R appuser:appgroup /app /home/appuser/.local

USER appuser

ENV HOME=/home/appuser
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONPATH=/home/appuser/.local/lib/python3.12/site-packages

EXPOSE 8000

ENTRYPOINT ["dumb-init", "--"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]