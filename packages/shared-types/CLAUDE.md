# @repo/shared-types

FE/BE 공유 zod DTO 스키마. **검증·타입의 단일 소스** — apps/api(nestjs-zod)와 apps/web(폼 검증)이 같은 스키마를 쓴다.

## Layout

- `src/dto/chat.dto.ts` — `createChatRoomSchema` · `sendMessageSchema` · `messagePageSchema` · 멤버 가입 스키마, 응답 타입 `ChatRoomDto`/`MessageDto`/`ChatRoomMemberDto`, 값 리스트 `CHAT_ROOM_TYPES`/`MESSAGE_TYPES`/`MEMBER_ROLES`, `MessageDirection` enum
- `src/dto/user.dto.ts` — `createUserSchema` · `loginSchema` · `UserDto`
- `src/dto/search.dto.ts` — `OffsetPage<T>`, `cursorPageSchema` · `searchQuerySchema` · `searchCursorPageSchema`
- `src/dto/ws.dto.ts` — Socket.IO 타입 계약 `ServerToClientEvents`/`ClientToServerEvents`, `WsErrorMessage`, `clientEvent()`
- `src/dto/serialized.ts` — `Serialized<T>` (Date → wire string 변환)
- `src/zod-error.ts` — `formatZodError`
- `src/dto/example.dto.ts` — 주석 처리된 nestjs-zod 사용 예시. **공개 API 아님** (`src/dto/index.ts`에서 미수출)

진입점 export는 `.`(루트)과 `./dto` 두 개 (`package.json` `exports` 참고).

## Naming convention

| 종류 | 패턴 | 예 |
|------|------|-----|
| zod 스키마 | `xxxSchema` | `createChatRoomSchema` |
| 입력 타입 | `XxxInput` (`z.infer`) | `CreateChatRoomInput` |
| 응답 타입 | `XxxDto` | `ChatRoomDto` |
| 값 리스트 | `UPPER_SNAKE` | `CHAT_ROOM_TYPES` |

## Non-obvious rules

- **`@repo/db`는 `import type`만.** 런타임 값 import 금지 — FE 번들에 drizzle/pg가 끌려들어가면 안 된다. 스키마/enum은 전부 type-only로 가져온다. (`chat.dto.ts` 등의 `import type { ... } from "@repo/db/schemas"`)
- **drizzle-zod 도입 금지.** zod 스키마는 손으로 쓰고 `satisfies z.ZodType<Pick<InsertX, ...>>`로 DB Insert 타입과 컴파일 타임 동기화한다. 값 리스트도 `as const satisfies readonly DbEnum[]`로 DB enum과 어긋나면 즉시 에러. drizzle-zod는 FE 번들/경계 때문에 의도적으로 배제됨.
- **`Serialized<T>`로 응답 타입을 감싼다.** `SelectX`를 `Serialized`로 감싸 Date를 ISO string으로 바꾸고 민감/내부 필드는 `Omit`. ⚠️ 타입에서 `Omit`해도 매퍼의 `...rest` 스프레드는 런타임에 그 필드를 그대로 흘려보낸다(스프레드엔 excess property check 미적용) — 매퍼 구조분해에서도 빼야 한다. `ChatRoomDto`가 `lastSeq`를 빼는 사례 참고.
- **password 검증 주의.** trim 금지(입력 변조 금지), bcrypt는 앞 72바이트만 쓰므로 바이트 상한을 두되 `Buffer` 대신 `TextEncoder`로 UTF-8 바이트를 센다(FE 호환). (`user.dto.ts`)
- 메시지 페이지네이션은 cursor 기반(`messagePageSchema`는 `cursorPageSchema.extend`), 유저 검색은 offset 기반(`searchQuerySchema` + `OffsetPage`). 둘을 섞지 말 것.

## Cross-module

- **의존** → `@repo/db` (type-only) — `packages/db/CLAUDE.md`
- **소비** → `apps/api`(`createZodDto(xxxSchema)`로 Nest DTO + ValidationPipe), `apps/web`(폼 검증 + 응답 타입). `ws.dto.ts`는 양측 Socket.IO 계약.
- 경계 규칙 전반은 루트 `CLAUDE.md` 참고.
