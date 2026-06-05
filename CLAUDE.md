# chat-service

Bun + Turborepo monorepo.

## Apps and Packages

- `apps/api`: [NestJS](https://nestjs.com/) server
- `apps/web`: [React](https://react.dev/) + [Vite](https://vite.dev/) app
- `packages/db` (`@repo/db`): Drizzle schema + db client
- `packages/shared-types` (`@repo/shared-types`): FE/BE 공유 zod DTO 스키마
- `packages/biome-config` (`@repo/biome-config`): shared [Biome](https://biomejs.dev/) configs — `base`, `nestjs`, `vite-react`, `react-internal`
- `packages/typescript-config` (`@repo/typescript-config`): shared `tsconfig` presets — `base`, `nestjs`, `vite`, `react-library`

## Stack

- [Bun 1.3.2]: 패키지 매니저 · 워크스페이스
- [Turborepo 2.9]: 모노레포 태스크 러너
- [Biome 2.3.8]: lint + format
- [TypeScript 5.9.2]: 타입 체크
- [React 19.2]: web UI 라이브러리
- [Vite 8]: web 개발 서버 · 번들러
- [NestJS 11]: api 서버 프레임워크
- [@nestjs/websockets + platform-socket.io 11]: Socket.IO 실시간 게이트웨이
- [@socket.io/redis-adapter 8.3]: 멀티 인스턴스 Socket.IO 이벤트 브로드캐스트
- [redis 6]: Redis 클라이언트
- [express-session 1.19 + connect-redis 9]: Redis 기반 세션 인증
- [@nestjs/config 4]: 환경변수 관리
- [Drizzle ORM 0.45]: PostgreSQL ORM
- [drizzle-kit 0.31]: DB 마이그레이션 생성·적용
- [pg 8.21]: PostgreSQL 드라이버
- [Zod 4.4]: 스키마 검증 — FE/BE 공유 DTO의 단일 소스
- [nestjs-zod 5.4]: zod 스키마를 Nest DTO · ValidationPipe로 연결

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
