# Production v2

ShoppingList v2 requires a clean PocketBase data directory. Do not point it at a v1 database.

## First deployment

1. Copy `.env.example` to `.env` and set `DOMAIN` plus SMTP values.
2. Start the stack with `docker compose -f compose.production.yml up -d`.
3. Create the first superuser inside the application container:

   ```sh
   docker compose -f compose.production.yml exec shoplist /app/shoplist superuser create admin@example.com
   ```

4. Open `https://your-domain/admin`, sign in, and configure the public catalog.

## Bring connector

Create an auth record in `service_accounts` with role `bring`. Put that email and password in
`PB_SERVICE_EMAIL` and `PB_SERVICE_PASSWORD`, add the Bring credentials, then start the profile:

```sh
docker compose -f compose.production.yml --profile bring up -d
```

Configure one or more `bring_links` records from the PocketBase dashboard. The service account can
only read/update Bring links and shopping items. It is not a superuser.

## Backup and restore drill

Back up the entire `/pb_data` volume while the app is stopped or use PocketBase's built-in backup
screen. A release is not production-ready until this restore drill succeeds:

```sh
docker compose -f compose.production.yml stop shoplist
docker run --rm -v shoppinglist_pb_data:/data -v "$PWD/backups:/backup" alpine \
  tar czf /backup/pb_data.tar.gz -C /data .
docker compose -f compose.production.yml start shoplist
```

Restore into a new empty volume, start the stack, and verify login, catalog, list membership and
item history before promoting a release.

## Release gate

Run `go test ./...`, `go vet ./...`, `govulncheck ./...`, `npm run build`, `npm run lint`, and
`npm audit --omit=dev` in both Node projects. Build the multi-architecture Docker image and Android
release artifacts in CI. Publish `v2.0.0` only after staging and the backup/restore drill pass.
