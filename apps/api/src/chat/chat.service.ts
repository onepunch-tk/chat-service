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
	CursorPageInput,
	MessageDto,
	SearchCursorPageInput,
	UserDto,
} from "@repo/shared-types";
import { CacheService } from "../redis/cache.service";
import { UserRepository } from "../user/user.repository";
import { ChatRoomRepository } from "./chat-room.repository";
import { ChatRoomMemberRepository } from "./chat-room-member.repository";
import { MessageRepository } from "./message.repository";
import { TypedEventEmitter } from "./typed-event-emitter";

/**
 * TODO(cache-invalidation): chatRooms:{id} 캐시는 memberCount/lastMessage 같은
 * "변동 필드"를 통째로 담으므로, 방 상태를 바꾸는 쓰기 경로에서 직접 무효화해야
 * 한다(아직 무효화 코드는 없음 — write 경로 활성화 전 필수):
 *   - sendMessage → cacheService.del("chatRooms", roomId)  // lastMessage 변경
 *   - join/leave  → cacheService.del("chatRooms", roomId)  // memberCount 변경
 */
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
	 * 채팅방 1건을 응답 DTO로 변환한다 — chatRoomsToDtos의 배치-of-1 위임.
	 *
	 * @param chatRoom 변환할 방(creator 관계 포함)
	 * @returns 캐시 또는 조립을 거친 ChatRoomDto
	 */
	private async chatRoomToDto(
		chatRoom: ChatRoomWithRelations,
	): Promise<ChatRoomDto> {
		const [chatRoomDto] = await this.chatRoomsToDtos([chatRoom]);
		return chatRoomDto;
	}

	/**
	 * 채팅방 목록을 응답 DTO 목록으로 변환한다. chatRooms:{id} 캐시의 유일한 경계.
	 *
	 * 캐시(getOrSetMany, fail-open read-through)를 먼저 조회하고, 미스난 방들만
	 * 배치 쿼리 2개(멤버 수 GROUP BY, 최신 메시지 DISTINCT ON)로 조립해 캐시를
	 * 채운다. 캐시 무효화 계약은 클래스 상단 TODO(cache-invalidation) 참고.
	 *
	 * 주의: creator/lastSeq는 반드시 구조분해로 빼야 한다 — `...rest` 스프레드로
	 * password 든 원본 User와 내부 카운터가 DTO·캐시·wire로 누출된다.
	 *
	 * @param chatRooms 변환할 방 목록(creator 관계 포함)
	 * @returns 입력과 같은 순서의 ChatRoomDto 배열
	 */
	private async chatRoomsToDtos(
		chatRooms: ChatRoomWithRelations[],
	): Promise<ChatRoomDto[]> {
		return this.cacheService.getOrSetMany(
			"chatRooms",
			chatRooms.map((cr) => cr.id),
			async (missKeys) => {
				const missKeySet = new Set(missKeys);
				const missed = chatRooms.filter((cr) => missKeySet.has(cr.id));
				const [memberCountMap, latestMessageMap] = await Promise.all([
					this.chatRoomMemberRepository.countActiveMembersByRoomIds(missKeys),
					this.messageRepository.findLatestMessagesByRoomIds(missKeys),
				]);

				const entries = await Promise.all(
					missed.map(async (cr): Promise<[number, ChatRoomDto]> => {
						// creator/lastSeq: 스프레드 누출 차단용으로 반드시 함께 구조분해
						const { createdBy, updatedAt, creator, lastSeq, ...rest } = cr;

						const latestMessage = latestMessageMap.get(cr.id) ?? null;

						// 서로 독립적인 I/O는 병렬로
						const [createdByDto, latestMessageDto] = await Promise.all([
							this.userToDto(creator),
							latestMessage ? this.messageToDto(latestMessage) : null,
						]);

						return [
							cr.id,
							{
								...rest,
								memberCount: memberCountMap.get(cr.id) ?? 0,
								lastMessage: latestMessageDto,
								createdBy: createdByDto,
								createdAt: cr.createdAt.toISOString(),
							},
						];
					}),
				);

				return new Map(entries);
			},
		);
	}

	/**
	 * 메시지 1건을 응답 DTO로 변환한다 — sender를 UserDto로 치환하고 날짜를 직렬화.
	 *
	 * @param message 변환할 메시지(sender 관계 포함)
	 * @returns MessageDto
	 */
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

	/**
	 * 방 멤버 1건을 응답 DTO로 변환한다 — user를 UserDto로 치환하고 날짜를 직렬화.
	 *
	 * @param member 변환할 멤버십(user 관계 포함)
	 * @returns ChatRoomMemberDto
	 */
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
	 * 유저를 id로 조회한다.
	 *
	 * @param userId 조회할 유저 id
	 * @returns 원본 User row (password 포함 — wire로 내보내지 말 것)
	 * @throws NotFoundException 유저가 없을 때
	 */
	private async findUserById(userId: number) {
		const user = await this.userRepository.findByUserId(userId);

		if (!user)
			throw new NotFoundException(`사용자를 찾을 수 없습니다: ${userId}`);

		return user;
	}

	/**
	 * 유저 1건을 응답 DTO로 변환한다 — password를 제거하고 users:{id}에 캐싱(TTL 1시간).
	 *
	 * TODO(cache-invalidation): UserDto의 status·lastSeenAt은 presence라 1시간 캐싱이
	 * 부적합 — presence write(connect/disconnect/heartbeat) 구현 시
	 * cacheService.del("users", id)를 함께 추가한다.
	 *
	 * @param user 변환할 원본 User row
	 * @returns 캐시 또는 변환을 거친 UserDto
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

	/**
	 * 채팅방을 생성하고 생성자를 OWNER로 가입시킨다. 성공 시 chatRoom.created
	 * 이벤트를 발행한다.
	 *
	 * @param userId 생성자 유저 id
	 * @param input 방 생성 입력(name, type 등)
	 * @returns 생성된 방의 ChatRoomDto (생성 직후 캐시 워밍됨)
	 * @throws NotFoundException 생성자 유저가 없을 때
	 */
	async createChatRoom(userId: number, input: CreateChatRoomInput) {
		const creator = await this.findUserById(userId);
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

	/**
	 * 채팅방 1건을 조회한다. 존재 검증은 DB가 담당하고(캐시 히트여도 방 row 조회
	 * 1회는 DB로 감), DTO 캐싱은 chatRoomToDto에 일임한다.
	 *
	 * @param roomId 조회할 방 id
	 * @returns ChatRoomDto
	 * @throws NotFoundException 방이 없을 때
	 */
	async getChatRoom(roomId: number): Promise<ChatRoomDto> {
		const chatRoom = await this.chatRoomRepository.findChatRoomById(roomId);
		if (!chatRoom)
			throw new NotFoundException(`채팅방을 찾을 수 없습니다: ${roomId}`);

		return this.chatRoomToDto(chatRoom);
	}

	/**
	 * 유저가 가입한 활성 방 목록을 updatedAt 내림차순 커서 페이지로 조회한다.
	 *
	 * @param userId 조회 대상 유저 id
	 * @param input 커서 페이지 입력(cursor: 마지막 방 id, limit)
	 * @returns ChatRoomDto 배열(최신 활동순)
	 */
	async getChatRooms(userId: number, input: CursorPageInput) {
		const chatRooms = await this.chatRoomRepository.findChatRoomsByUserId(
			userId,
			input,
		);
		return this.chatRoomsToDtos(chatRooms);
	}

	/**
	 * 활성 방을 createdAt 내림차순 커서 페이지로 검색한다. query가 없으면 전체
	 * 활성 방 피드(browse), 있으면 이름 부분일치(ILIKE) 검색.
	 *
	 * @param input 검색 입력(query?: 2자 이상 검색어, cursor: 마지막 방 id, limit)
	 * @returns ChatRoomDto 배열(최신 생성순)
	 */
	async searchChatRooms(input: SearchCursorPageInput) {
		const chatRooms =
			await this.chatRoomRepository.searchActiveChatRoomsByName(input);
		return this.chatRoomsToDtos(chatRooms);
	}
}
