# web

React 19 + Vite + TypeScript app.

- Lint/format: [Biome](https://biomejs.dev/) — extends `@repo/biome-config/base` + `@repo/biome-config/vite-react`
- tsconfig: extends `@repo/typescript-config/vite.json` (project references: `tsconfig.app.json` / `tsconfig.node.json`)

```sh
bun run dev        # vite dev server (:5173)
bun run build      # tsc -b && vite build
bun run preview    # preview production build
bun run lint       # biome check --write
bun run typecheck  # tsc -b
```
