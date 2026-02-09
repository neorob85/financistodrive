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

Build the image

```bash
docker build -t financisto-drive .
```

Then start the image

```bash
docker run -d \
  --name financisto-drive \
  -p 3000:3000 \
  -v financisto-data:/app/server/data \
  -v financisto-uploads:/app/public/uploads \
  financisto-drive
```

