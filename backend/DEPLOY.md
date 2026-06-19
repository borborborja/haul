# Deploy y actualización

Guía práctica para desplegar y **actualizar** ShoppingList con Docker.

## Modelo de identidad (v2.1+)
Todo usuario es por defecto un **invitado**: puede crear y compartir listas sin
registrarse. Una **cuenta** (email + contraseña) solo añade **portabilidad** —
sirve para recuperar tus listas en otro dispositivo. Desde Ajustes:
- **Guardar mis listas**: convierte el invitado actual en cuenta *in situ* (misma
  identidad, conserva listas y membresías).
- **Ya tengo cuenta · Entrar**: inicia sesión y recupera tus listas (selector si hay varias).
- **Cerrar sesión**: vuelve a modo invitado (pregunta si conservar la lista local).

Los invitados inactivos > 90 días **y sin ninguna lista** se purgan automáticamente
en cada arranque del servidor.

La imagen oficial es **`borborbor/shoppinglist`** en Docker Hub. Cada push a `main`
publica automáticamente nuevas imágenes vía GitHub Actions.

## Qué tag usar

| Tag | Cuándo se reconstruye | Uso recomendado |
|-----|-----------------------|-----------------|
| `borborbor/shoppinglist:latest` | En cada push a `main` | Producción "siempre al día" |
| `borborbor/shoppinglist:main`   | En cada push a `main` | Igual que `latest` |
| `borborbor/shoppinglist:vX.Y.Z` | Solo al publicar el tag git `vX.Y.Z` | Producción con versión fijada/reproducible |
| `borborbor/shoppinglist:<sha>`  | En cada commit | Depuración / rollback puntual |

> ⚠️ **Causa típica de "no actualiza":** si fijas una versión concreta (p. ej.
> `:v2.0.0`), ese tag **nunca cambia**. Aunque hagas `pull`, seguirás con la misma
> imagen. Para recibir cambios o bien usas `:latest` / `:main`, o subes el número
> de versión y fijas el nuevo tag (`:v2.0.2`, etc.).

## Primer despliegue

1. Copia `.env.example` a `.env` y rellena `DOMAIN` y, si quieres email, los valores SMTP.
2. Arranca el stack:

   ```sh
   docker compose -f compose.production.yml up -d
   ```

3. **Abre `https://tu-dominio/admin`.** La primera vez aparece un asistente de
   configuració inicial (wizard) que pide:
   - Pas 1 — dades de la instància: nom i interruptors (app web, noms d'usuari,
     accés remot).
   - Pas 2 — administrador: correu i contrasenya del superusuari (mín. 8 caràcters).

   En finalitzar es crea el superusuari, es desa la configuració i s'inicia sessió
   automàticament. El wizard només apareix mentre no hi ha cap superusuari; un cop
   creat, `/admin` mostra la pantalla d'inici de sessió normal.

4. Configura el catálogo público desde el panel.

> ¿Olvidaste la contraseña? Crea/actualiza un superusuario a mano (esto vuelve a
> ocultar el wizard):
>
> ```sh
> docker compose -f compose.production.yml exec -u shoplist shoplist \
>   /app/shoplist superuser upsert admin@admin.com 'NuevaContraseña' --dir /pb_data
> ```

> El contenedor corre como usuario sin privilegios pero ajusta los permisos de
> `/pb_data` automáticamente al arrancar, así que funciona tanto con volúmenes
> nombrados como con bind-mounts (`/opt/dades/...`) sin tener que hacer `chown` a mano.

## Actualizar a una versión nueva

```sh
# Descarga la imagen nueva del tag que uses (latest / main / vX.Y.Z)
docker compose -f compose.production.yml pull

# Recrea solo los contenedores cuya imagen ha cambiado
docker compose -f compose.production.yml up -d
```

Si fijas versión por variable de entorno, apunta al nuevo tag antes de hacer pull:

```sh
SHOPLIST_IMAGE=borborbor/shoppinglist:v2.0.2 docker compose -f compose.production.yml up -d
```

o ponlo en tu `.env`:

```env
SHOPLIST_IMAGE=borborbor/shoppinglist:v2.0.2
```

### Si aún ves la versión vieja

- **Comprueba el digest** que tienes vs. el del registro:

  ```sh
  docker image inspect borborbor/shoppinglist:latest --format '{{index .RepoDigests 0}}'
  docker manifest inspect borborbor/shoppinglist:latest | grep -m1 digest
  ```

- **Fuerza un pull limpio** (por si Docker cacheó):

  ```sh
  docker compose -f compose.production.yml pull --no-cache 2>/dev/null || \
    docker pull borborbor/shoppinglist:latest
  docker compose -f compose.production.yml up -d --force-recreate
  ```

- **La PWA / app web cachea en el navegador.** Tras actualizar la imagen, en el
  móvil/navegador haz "hard refresh" o cierra y reabre la PWA: el service worker
  detecta la versión nueva (`VITE_APP_VERSION`) y se actualiza solo en el siguiente arranque.

- **App Android:** el APK envuelve el build web. Una versión nueva requiere
  reinstalar el APK generado por el workflow *Build Android APK* (no se actualiza
  solo al cambiar la imagen Docker del servidor).

## Watchtower (actualización automática)

Si usas Watchtower, fija un tag móvil (`:latest` o `:main`) para que detecte
imágenes nuevas. Con un tag de versión fijo (`:v2.0.2`) Watchtower no actualizará
porque ese tag no cambia.

## Publicar una versión nueva (mantenedor)

1. Sube la versión en `web/package.json`, `web/vite.config.ts` (`VITE_APP_VERSION`)
   y `extensions/bring-connector/package.json`.
2. Commit y push a `main` (publica `:latest`, `:main` y `:<sha>`).
3. Crea y sube el tag git para fijar la versión:

   ```sh
   git tag v2.0.2
   git push origin v2.0.2
   ```

   El workflow *Build and Push Docker Image* construye y publica
   `borborbor/shoppinglist:v2.0.2`.

## Backup de datos

Toda la información vive en el volumen `/pb_data`. Haz backup con la app parada:

```sh
docker compose -f compose.production.yml stop shoplist
docker run --rm -v shoppinglist_pb_data:/data -v "$PWD/backups:/backup" alpine \
  tar czf /backup/pb_data.tar.gz -C /data .
docker compose -f compose.production.yml start shoplist
```

## Bring connector (opcional)

El servicio `bring-connector` está bajo el profile `bring` y su imagen **no se
publica en Docker Hub** (no hay workflow para ella). Si la necesitas, constrúyela
en local con `docker compose -f docker-compose.yml --profile bring up -d --build`
desde el repo.
