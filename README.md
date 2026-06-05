# chat-service

Bun + Turborepo monorepo.

## Apps and Packages

- `apps/api`: [NestJS](https://nestjs.com/) server
- `apps/web`: [React](https://react.dev/) + [Vite](https://vite.dev/) app
- `packages/ui` (`@repo/ui`): shared React component library
- `packages/biome-config` (`@repo/biome-config`): shared [Biome](https://biomejs.dev/) configs — `base`, `nestjs`, `vite-react`, `react-internal`
- `packages/typescript-config` (`@repo/typescript-config`): shared `tsconfig` presets — `base`, `nestjs`, `vite`, `react-library`

## Tooling

- [Bun](https://bun.sh/) — package manager
- [Turborepo](https://turborepo.dev/) — task runner
- [Biome](https://biomejs.dev/) — lint + format
- [TypeScript](https://www.typescriptlang.org/) — type checking

## Commands

```sh
bun install        # install dependencies
bun run dev        # start all dev servers (api :3000, web :5173)
bun run build      # build all apps
bun run lint       # biome check --write per package
bun run typecheck  # tsc per package
bun run format     # biome format --write (repo-wide)
```

Filter to one package: `bun run dev --filter=api`
