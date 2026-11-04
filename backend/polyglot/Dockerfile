FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 g++ openjdk-17-jdk-headless libgoogle-gson-java nlohmann-json3-dev && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y --no-install-recommends golang-go rustc cargo librust-serde-json-dev mono-mcs libnewtonsoft-json-cil-dev kotlin gcc libcjson-dev ruby php-cli && rm -rf /var/lib/apt/lists/*
RUN npm install --global typescript@5.9.3 @types/node@24.10.0
COPY prepare-runtimes.py /opt/prepare-runtimes.py
RUN python3 /opt/prepare-runtimes.py
ENV PYTHONDONTWRITEBYTECODE=1
USER 65534:65534
