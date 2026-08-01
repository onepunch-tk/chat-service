# api

NestJS 11 채팅 서버. **HTTP(express-session 인증) + Socket.IO 실시간 게이트웨이**. Redis는 세션 store · 캐시 · socket.io 멀티 인스턴스 어댑터 세 역할을 겸하고, PostgreSQL은 `@repo/db`로 접근한다.

## Layout

명령은 `apps/api`에서 실행한다. `src/` 아래는 도메인/인프라 모듈로 나뉜다.

- `main.ts` — bootstrap. express-session(connect-redis store) 미들웨어를 만들어 HTTP에 `app.use`하고, **같은 인스턴스**를 `RedisIoAdapter`에 넘겨 WS 핸드셰이크에도 태운다. CORS는 `http://localhost:5173` + credentials.
- `app.module.ts` — 루트. `ConfigModule.forRoot({ isGlobal, envFilePath: "../../.env" })`(env는 **레포 루트 `.env`**) + `EventEmitterModule.forRoot()` + 전역 `APP_PIPE = ZodValidationPipe`.
- `chat/` — 채팅 도메인(순수 도메인 모듈, WS 엣지 없음). `chat.service.ts`(**492줄 god file** — 방·멤버·메시지 유스케이스 + 캐시 오케스트레이션 + DTO 매핑 전부) + 3 repository(`chat-room` · `chat-room-member` · `message`). `ChatService`만 export.
- `user/` — 유저 도메인. `user.service.ts`(가입·로그인·검색·lastSeen), `user.repository.ts`, `user.controller.ts`(현재 `POST /users/sign-in`만). `UserRepository`를 export → `ChatService`가 소비.
- `session/` — 세션 인증. `session.service.ts`(establish·terminate·touch · 단일 활성 세션), `ws-session.guard.ts`(WS 메시지마다 재검증), `session.type.d.ts`(express-session 모듈 augmentation으로 `session.userId` 타이핑).
- `websocket/` — 이 앱의 **유일한 WS 엣지**. `ws.gateway.ts`(도메인 이벤트↔소켓 변환만), `ws.channels.ts`(room 키 빌더), `ws.types.ts`(typed `Server`/`Socket`), `ws-zod-exception.filter.ts`, `dto/send-message.dto.ts`.
- `events/` — 앱 내부 도메인 이벤트 버스. `domain.events.ts`(이벤트↔payload 맵 — **백엔드 전용**), `typed-event-emitter.ts`(EventEmitter2 타입 facade).
- `redis/` — Redis 인프라. `redis.constant.ts`(`CACHE_TTL` 단일 소스 · `REDIS_CLIENT` 토큰 · `RECENT_MESSAGES_MAX`), `redis.service.ts`(저수준 GET/SET/LIST primitive), `cache.service.ts`(fail-open 캐시 파사드 + `getOrSetMany` 배치), `redis-io.adapter.ts`(socket.io redis-adapter + 세션 미들웨어).
- `database/` — `database.module.ts`(`@Global`, `createDbClient` 팩토리, `DRIZZLE` 토큰 export, `onApplicationShutdown`에서 close), `database.constant.ts`(`DRIZZLE`/`DB_CLIENT` 토큰 + `QueryLogger`), `like.util.ts`(`escapeLike`).
- `crypto/` — `crypto.service.ts`(bcrypt 해시/비교 + timing-safe `dummyHash`).

## Commands

```sh
bun run dev        # nest start --watch (:3000)
bun run build      # nest build → dist/
bun run typecheck  # tsc --noEmit
bun run lint       # biome check --write
bun run test       # jest (--passWithNoTests, *.spec.ts)
```

레포 루트에서 `bun run dev --filter=api`로도 띄울 수 있다. 실행에는 PostgreSQL · Redis와 루트 `.env`(`SESSION_SECRET` · `PG_*` · `REDIS_*`)가 필요하다.

## Non-obvious rules

- **WS 어댑터는 http 서버를 직접 넘긴다.** `RedisIoAdapter`가 `super(app.getHttpServer())`로 호출하는 건 의도된 우회다 — Bun isolated linker가 `@nestjs/core`를 2벌로 쪼개 `app instanceof NestApplication` 분기가 실패하면 app 객체가 httpServer 자리에 저장돼 socket.io가 `app.listeners()`를 호출하다 크래시한다. (`redis/redis-io.adapter.ts`)
- **DTO 매핑은 `...rest` 스프레드 누출에 주의.** 타입에서 `Omit`해도 스프레드는 런타임에 필드를 흘려보낸다. `chatRoomsToDtos`는 `creator`/`lastSeq`를, `userToDto`는 `password`를 **반드시 구조분해로 함께 빼야** wire·캐시로 누출되지 않는다. (`chat/chat.service.ts` — `@repo/shared-types`의 `Serialized` 함정과 동일)
- **캐시는 네임스페이스마다 전략이 다르다.** `chatRooms`=write-then-del blob · `chatRoomMembers`=del 무효화 목록 · `messages`=write-through LIST · `users`=read-through 단건. `CACHE_TTL`이 TTL 단일 소스고 `null`은 영속을 뜻한다. 무효화 계약은 `chat.service.ts` 상단 주석 참고(메시지 edit/delete 구현 시 `messages`+`chatRooms` 둘 다 무효화). (`chat/chat.service.ts`, `redis/redis.constant.ts`)
- **"존재하는 LIST는 완전하다" 불변식.** `messages` LIST는 `listRebuild`(DEL→RPUSH→EXPIRE)만 생성하고, `listPushTrim`은 LPUSHX라 키가 없으면 no-op이다 — 부분 리스트 오염을 막는다. 그래서 첫 페이지(`cursor===null` + `BEFORE` + `limit ≤ RECENT_MESSAGES_MAX`)만 캐시로 서빙하고, 미스는 최신 N개로 rebuild한 뒤 응답만 잘라낸다. (`chat/chat.service.ts` `getMessages`, `redis/cache.service.ts`)
- **에러 정책은 "저장소"가 아니라 "용도"의 속성이다.** 캐시는 fail-open(에러를 삼켜 miss로 강등 → DB 폴백), 세션/인증은 fail-closed(에러 전파). 그래서 try/catch는 `CacheService`에만 있고 `SessionService`는 `RedisService`를 직접 쓴다. RedisService에 try/catch를 박지 말 것. (`redis/cache.service.ts`)
- **소켓 라우팅 채널은 빌더로만 만든다.** `userChannel`/`roomChannel`/`sessionChannel`. `socketsJoin`/`emit`은 매칭되는 room이 없으면 **조용한 no-op**이라, 한 글자 오타가 런타임 에러 없이 메시지를 증발시킨다. 빌더로 단일화해 오타를 컴파일 에러로 만든다. (`websocket/ws.channels.ts`)
- **도메인 이벤트는 타입 facade로 강제한다.** `TypedEventEmitter.emit`은 `DomainEvents` 맵으로 이름·payload를 강제하지만, 수신 `@OnEvent`은 무검증 문자열이라 `chatEvent()`/`sessionEvent()` 가드 + `ChatDomainEvents["..."]` annotation으로 같은 맵에 묶는다. 이벤트는 FE로 안 가는 백엔드 전용이라 `shared-types`가 아니라 `events/domain.events.ts`에 둔다. (`events/`)
- **WS 세션은 매 메시지 재검증한다.** `WsSessionGuard`가 메시지마다 `sessionService.touch()`로 저장소를 재조회한다 — 핸드셰이크 스냅샷이 아니므로 만료·로그아웃·중복 로그인 kick을 즉시 잡는다. 단일 활성 세션을 위해 `userSession`(userId→sessionId) 인덱스는 **영속(TTL 없음)**, 본체 `redisSession`만 rolling으로 연장한다. (`session/`)
- **연결 시 user 채널 join이 bulk-join 조회보다 먼저다.** `handleConnection`에서 `socket.join(userChannel)`을 조회 전에 해야, 조회 도중 도착한 `memberJoined`의 `socketsJoin`이 이 소켓을 잡을 수 있어 새 방 구독 누락 창이 닫힌다. (`websocket/ws.gateway.ts`)
- **로그인 timing enumeration 방지.** 없는 유저도 `dummyHash`와 bcrypt.compare해 응답 시간을 평탄화하고, 가입은 `onConflictDoNothing`→null로 TOCTOU race를 `ConflictException`으로 막는다(race 시 500 방지). (`crypto/crypto.service.ts`, `user/user.service.ts`)

> **현재 상태(WIP):** HTTP 표면은 `POST /users/sign-in`뿐이고 대부분 흐름은 WS 기반이다. 게이트웨이의 `@SubscribeMessage(sendMessage)`는 아직 스텁이며(`ChatService.sendMessage`는 완성), 로그인 컨트롤러는 `SessionService.establish`를 아직 호출하지 않는다. 새 유스케이스를 붙일 때 참고.

## Cross-module

- **의존** → `@repo/db`(`createDbClient` + schema + 쿼리 연산자, **런타임**), `@repo/shared-types`(`createZodDto`로 Nest DTO·ValidationPipe, 응답 DTO, Socket.IO 계약). 연산자를 `drizzle-orm`에서 직접 import하면 phantom dependency로 하드 실패 — 반드시 `@repo/db` 경유. `packages/db/CLAUDE.md` · `packages/shared-types/CLAUDE.md` 참고.
- **WS 계약** — `ServerToClientEvents`/`ClientToServerEvents`(`shared-types/ws.dto.ts`)를 `apps/web` Socket.IO 클라이언트와 공유한다. `clientEvent()`로 수신 이벤트 이름을 묶는다.
- 경계 규칙 전반은 루트 `CLAUDE.md` 참고.
