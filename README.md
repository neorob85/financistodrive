For years I used the open source Financisto app to manage my finances.
You can find it herer https://github.com/dsolonenko/financisto

This app is a sort of Financisto clone, but with a different approach.

You can track expenses, income and transfers between accounts and also manage your vehicles. All in one.

It supports PWA with notifications.

To be clear: yes, I used a lot of AI (Claude Opus 4.5) to make this app.

Download the app and enjoy it!


# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

# Docker

## Build

Use the build script, which reads the version from `package.json` and tags the
image twice — with that version and with `latest`:

```bash
sudo ./build.sh
```

For `"version": "1.0.0"` this produces `financistodrive:1.0.0` and
`financistodrive:latest` (two tags on the same image).

Options, as environment variables:

```bash
IMAGE_NAME=myregistry/financistodrive ./build.sh   # different image name
PUSH=1 IMAGE_NAME=myregistry/financistodrive ./build.sh   # build and push both tags
```

The version is also baked into the image as the `APP_VERSION` environment
variable and as the `org.opencontainers.image.version` label, and it is what the
app shows next to its name in the top bar.

## Releasing a new version

```bash
npm version patch   # or minor / major — bumps package.json and creates a git tag
sudo ./build.sh
```

Older images keep their version tag, so `docker images financistodrive` lists
every release you have built and you can go back to any of them. Note that
rolling back the image does **not** roll back the database: take a backup before
upgrading if a release changes the schema.

## Run

```bash
docker run -d \
  --name financistodrive \
  -p 3000:3000 \
  -v financisto-data:/app/server/data \
  -v financisto-uploads:/app/public/uploads \
  financistodrive:latest
```

## Portainer stack

Reference the tag through a variable so the version can be picked from the
Portainer UI:

```yaml
services:
  financistodrive:
    image: financistodrive:${APP_TAG:-latest}
    pull_policy: never   # image is built locally, not pulled from a registry
    container_name: financistodrive
    ports:
      - "3000:3000"
    volumes:
      - financisto-data:/app/server/data
      - financisto-uploads:/app/public/uploads
    restart: unless-stopped

volumes:
  financisto-data:
  financisto-uploads:
```

Set `APP_TAG` in the stack's *Environment variables* (e.g. `1.0.0`) and redeploy
to switch version; leave it unset to follow `latest`.

