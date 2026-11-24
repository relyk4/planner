# Planner: offline dependency planner. Python standard library only, so the
# build downloads nothing beyond the base image.
#
# Air-gapped? Point BASE_IMAGE at the Python image your registry already has:
#   docker build --build-arg BASE_IMAGE=registry.example.mil/python:3.12 -t planner:1.0.0 .
ARG BASE_IMAGE=python:3.12-slim
FROM ${BASE_IMAGE}

WORKDIR /app
COPY server.py ./
COPY static ./static

ENV PLANNER_HOST=0.0.0.0 \
    PLANNER_PORT=8080 \
    PLANNER_DATA=/data \
    PYTHONUNBUFFERED=1

RUN mkdir -p /data && chown -R 10001:0 /data && chmod -R g+rwX /data
VOLUME ["/data"]
EXPOSE 8080
USER 10001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=4).status == 200 else 1)"

CMD ["python", "server.py"]
