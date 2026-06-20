FROM node:24.1.0-alpine3.21 AS frontend
WORKDIR /src/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM golang:1.26.4-alpine3.22 AS backend
WORKDIR /src
RUN apk add --no-cache build-base
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
COPY migrations ./migrations
RUN CGO_ENABLED=1 go build -trimpath -ldflags="-s -w" -o /out/shoplist .

FROM alpine:3.22.1
RUN apk add --no-cache ca-certificates tzdata su-exec \
    && addgroup -S shoplist \
    && adduser -S -G shoplist -h /app shoplist \
    && mkdir -p /app/pb_public /pb_data \
    && chown -R shoplist:shoplist /app /pb_data
WORKDIR /app
COPY --from=backend /out/shoplist /app/shoplist
COPY --from=frontend /src/web/dist /app/pb_public
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
VOLUME ["/pb_data"]
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:8090/api/shoplist/health >/dev/null || exit 1
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["serve", "--http=0.0.0.0:8090", "--dir=/pb_data"]
