import { Injectable, NotFoundException } from "@nestjs/common";
import {
	ChatRoomMemberWithMemberRelations,
	ChatRoomWithRelations,
	MessageWithSenderRelations,
	SelectUser,
} from "@repo/db/schemas";
import {
	ChatRoomDto,
	ChatRoomMemberDto,
	CreateChatRoomInput,
	MessageDto,
	UserDto,
} from "@repo/shared-types";
import { CacheService } from "../redis/cache.service";
import { UserRepository } from "../user/user.repository";
import { ChatRoomRepository } from "./chat-room.repository";
import { ChatRoomMemberRepository } from "./chat-room-member.repository";
import { MessageRepository } from "./message.repository";
import { TypedEventEmitter } from "./typed-event-emitter";

@Injectable()
export class ChatService {
	constructor(
		private readonly cacheService: CacheService,
		private readonly chatRoomRepository: ChatRoomRepository,
		private readonly messageRepository: MessageRepository,
		private readonly chatRoomMemberRepository: ChatRoomMemberRepository,
		private readonly userRepository: UserRepository,
		private readonly events: TypedEventEmitter,
	) {}

	/**
	 * 방 1건 → 응답 DTO. 캐시 정책(fail-open read-through)은 CacheService.getOrSet에 위임한다.
	 *
	 * [수정 전 실수 — creator 누출] 구조분해에서 createdBy/updatedAt만 빼고 creator를
	 * 남기면, `...rest` 스프레드로 password까지 든 원본 User가 DTO·캐시·wire로 새어나간다.
	 * TS의 excess property check는 "스프레드로 들어온" 속성엔 적용되지 않아 컴파일도
	 * 통과한다 → 관계 키(creator)와 내부 컬럼(lastSeq)은 반드시 구조분해로 빼야 한다.
	 * (messageToDto/memberToDto는 처음부터 sender/user를 빼서 안전했고, 여기만 누락이었다.)
	 *
	 * [캐시 무효화 계약 — 공개 메서드 구현 시 필수]
	 * 이 캐시는 memberCount/lastMessage 같은 "변동 필드"를 통째로 담는다. 방 상태를
	 * 바꾸는 쓰기 경로에서 직접 무효화해야 한다(아직 무효화 코드는 없음):
	 *   - sendMessage → cacheService.del("chatRooms", roomId)  // lastMessage 변경
	 *   - join/leave  → cacheService.del("chatRooms", roomId)  // memberCount 변경
	 * createRoom만 비우는 것으로는 부족하다 — 생성 시점엔 캐시가 비어 있고, 정작 자주
	 * 바뀌는 건 sendMessage/leave다.
	 * TODO(cache-invalidation): 위 del 호출은 sendMessage/join/leave 구현 시 함께 추가한다
	 *   — write 경로 활성화 전 필수(현재는 write 경로가 unreachable이라 미동작).
	 *
	 * [수정 전 착각 — @Cacheable은 사실 no-op였다] 원본 Kotlin의 @Cacheable은 private
	 * 메서드 + 같은 빈 내부 self-invocation이라 Spring AOP 프록시를 우회 → 실제론 캐싱이
	 * 동작하지 않고 항상 재계산됐다(그래서 무효화가 없어도 stale이 없었다). 이 수동 캐시는
	 * "진짜로" 동작하므로 무효화는 전적으로 우리 책임이 됐다.
	 *
	 * [한계 — 중첩 비정규화] createdBy/lastMessage.sender의 UserDto가 이 blob에 "값 복사"로
	 * 박힌다. users:{id}를 갱신해도 방 캐시 안 사본은 안 바뀌므로, 방 무효화로만 갱신된다.
	 */
	private chatRoomToDto(chatRoom: ChatRoomWithRelations): Promise<ChatRoomDto> {
		return this.cacheService.getOrSet<ChatRoomDto>(
			"chatRooms",
			chatRoom.id,
			async () => {
				// creator/lastSeq: 스프레드 누출 차단용으로 반드시 함께 구조분해한다.
				const { createdBy, updatedAt, creator, lastSeq, ...rest } = chatRoom;

				// 서로 독립적인 I/O는 병렬로 — 캐시 miss 지연을 max(...)로 줄인다.
				const [memberCount, lastMessage, createdByDto] = await Promise.all([
					this.chatRoomMemberRepository.countActiveMembers(chatRoom.id),
					this.messageRepository.findLatestMessage(chatRoom.id),
					this.userToDto(creator),
				]);

				return {
					...rest,
					memberCount,
					createdBy: createdByDto,
					lastMessage: lastMessage
						? await this.messageToDto(lastMessage)
						: null,
					createdAt: chatRoom.createdAt.toISOString(),
				};
			},
		);
	}

	private async messageToDto(
		message: MessageWithSenderRelations,
	): Promise<MessageDto> {
		const { senderId, sender, ...rest } = message;

		return {
			...rest,
			sender: await this.userToDto(sender),
			createdAt: message.createdAt.toISOString(),
			editedAt: message.editedAt?.toISOString() ?? null,
		};
	}

	private async memberToDto(
		member: ChatRoomMemberWithMemberRelations,
	): Promise<ChatRoomMemberDto> {
		const { chatRoomId, userId, createdAt, ...rest } = member;

		return {
			...rest,
			user: await this.userToDto(member.user),
			joinedAt: member.joinedAt.toISOString(),
			leftAt: member.leftAt?.toISOString() ?? null,
		};
	}

	/**
	 * 유저 → 응답 DTO. 캐시 정책은 CacheService.getOrSet에 위임(TTL 3600s).
	 *
	 * [주의 — presence 캐싱] UserDto엔 status·lastSeenAt(온라인/마지막 접속)이 들어 있어
	 * 1시간 캐싱하면 presence가 최대 1시간 멈춘다. 게이트웨이 connect/disconnect/하트비트
	 * 에서 cacheService.del("users", id)로 무효화하거나, 불변 프로필과 휘발 presence를
	 * 분리해야 한다. (DTO 분리는 FE 계약 변경이므로 게이트웨이 단계에서 합의 후 진행.)
	 * TODO(cache-invalidation): presence write(connect/disconnect/heartbeat) 구현 시
	 *   cacheService.del("users", id)를 함께 추가한다.
	 */
	private userToDto(user: SelectUser): Promise<UserDto> {
		return this.cacheService.getOrSet<UserDto>("users", user.id, () => {
			const { password, updatedAt, ...rest } = user;

			return {
				...rest,
				createdAt: user.createdAt.toISOString(),
				lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
			};
		});
	}

	async createChatRoom(userId: number, input: CreateChatRoomInput) {
		const creator = await this.userRepository.findByUserId(userId);
		if (!creator)
			throw new NotFoundException(`사용자를 찾을 수 없습니다: ${userId}`);

		const chatRoom = await this.chatRoomRepository.createChatRoom(
			userId,
			input,
		);
		this.events.emit("chatRoom.created", {
			creatorId: userId,
			roomId: chatRoom.id,
		});

		return this.chatRoomToDto({ ...chatRoom, creator });
	}
}
