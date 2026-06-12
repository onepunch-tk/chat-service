import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
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
	MessageDirection,
	MessageDto,
	MessagePageInput,
	SearchCursorPageInput,
	SendMessageInput,
	UserDto,
} from "@repo/shared-types";
import { TypedEventEmitter } from "../events/typed-event-emitter";
import { CacheService } from "../redis/cache.service";
import { RECENT_MESSAGES_MAX } from "../redis/redis.constant";
import { UserRepository } from "../user/user.repository";
import { ChatRoomRepository } from "./chat-room.repository";
import { ChatRoomMemberRepository } from "./chat-room-member.repository";
import { MessageRepository } from "./message.repository";

/**
 * 캐시 계약 — 네임스페이스별로 전략이 다르다:
 * - chatRooms:{id}: memberCount/lastMessage 같은 변동 필드를 통째로 담는 read-through
 *   blob. 방 상태를 바꾸는 쓰기 경로(join/leave/sendMessage)가 write-then-del로 직접
 *   무효화한다.
 * - chatRoomMembers:{roomId}: read-through 목록. join/leave가 del로 무효화한다.
 * - messages:{roomId}: 최신 N개 LIST의 write-through(materialized view). sendMessage가
 *   LPUSHX+LTRIM으로 직접 끌고 가므로 무효화가 없고, 리스트 생성은 getMessages의
 *   rebuild 전용이다(부분 리스트 오염 차단 — docs/learn의 message-cache 설계 참고).
 * - users:{id}: read-through 단건. presence 필드의 TTL 부적합 문제는 userToDto TODO 참고.
 *
 * 메시지 edit/delete 경로 구현 시: del("messages") 통째 무효화 + del("chatRooms")
 * (lastMessage가 그 메시지였을 수 있다) 둘 다 필요하다.
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
		const { chatRoomId, userId, createdAt, user, ...rest } = member;
		return {
			...rest,
			user: await this.userToDto(user),
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
	 * 채팅방을 id로 조회한다.
	 *
	 * @param roomId 조회할 방 id
	 * @returns 방 row (creator 관계 포함)
	 * @throws NotFoundException 방이 없을 때
	 */
	private async findChatRoomById(roomId: number) {
		const chatRoom = await this.chatRoomRepository.findChatRoomById(roomId);
		if (!chatRoom)
			throw new NotFoundException(`채팅방을 찾을 수 없습니다: ${roomId}`);

		return chatRoom;
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
	 * 채팅방을 생성하고 생성자를 OWNER로 가입시킨다. 성공 시 chatRoom.memberJoined
	 * 이벤트를 발행해 생성자의 활성 소켓을 방 채널에 합류시킨다.
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

		this.events.emit("chatRoom.memberJoined", {
			userId,
			roomId: chatRoom.id,
		});

		return this.chatRoomToDto({ ...chatRoom, creator });
	}

	/**
	 * 채팅방 1건을 조회한다 — 캐시 우선(@Cacheable 시맨틱). 히트면 DB를 거치지
	 * 않고, 미스에서만 방 row를 조회해 조립한다(캐시 채움은 chatRoomToDto 경유).
	 *
	 * @param roomId 조회할 방 id
	 * @returns ChatRoomDto
	 * @throws NotFoundException 방이 없을 때 (캐시 미스 경로에서만 검증됨)
	 */
	async getChatRoom(roomId: number): Promise<ChatRoomDto> {
		const cached = await this.cacheService.get<ChatRoomDto>(
			"chatRooms",
			roomId,
		);
		if (cached) return cached;

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

	/**
	 * 채팅방에 MEMBER로 가입한다 — 재가입은 upsert가 기존 행을 재활성화한다.
	 * 성공 시 관련 캐시를 무효화(write-then-del)하고 chatRoom.memberJoined 이벤트를
	 * 발행해 가입자의 활성 소켓을 방 채널에 합류시킨다.
	 *
	 * @param userId 가입할 유저 id
	 * @param chatRoomId 대상 방 id
	 * @throws NotFoundException 유저 또는 방이 없을 때
	 * @throws ConflictException 이미 참여 중일 때
	 */
	async joinChatRoom(userId: number, chatRoomId: number) {
		const [user, chatRoom] = await Promise.all([
			this.findUserById(userId),
			this.findChatRoomById(chatRoomId),
		]);

		const alreadyJoined =
			await this.chatRoomMemberRepository.existsActiveMember({
				userId: user.id,
				chatRoomId: chatRoom.id,
			});
		if (alreadyJoined) throw new ConflictException("이미 참여한 채팅방입니다.");

		await this.chatRoomMemberRepository.joinMember({
			chatRoomId: chatRoom.id,
			userId: user.id,
			role: "MEMBER",
		});

		//write-then-del
		await Promise.all([
			this.cacheService.del("chatRoomMembers", chatRoomId),
			this.cacheService.del("chatRooms", chatRoomId),
		]);

		this.events.emit("chatRoom.memberJoined", {
			userId,
			roomId: chatRoom.id,
		});
	}

	/**
	 * 채팅방에서 탈퇴한다 — soft-delete(isActive=false, 행 유지).
	 * 성공 시 관련 캐시를 무효화(write-then-del)하고 chatRoom.memberLeft 이벤트를
	 * 발행해 탈퇴자의 소켓을 방 채널에서 제거한다.
	 *
	 * @param userId 탈퇴할 유저 id
	 * @param chatRoomId 대상 방 id
	 * @throws ConflictException 참여 중인 멤버가 아닐 때
	 */
	async leaveChatRoom(userId: number, chatRoomId: number) {
		const left = await this.chatRoomMemberRepository.leave({
			userId,
			chatRoomId,
		});
		if (!left) throw new ConflictException("참여하지 않은 채팅방입니다.");

		//write-then-del
		await Promise.all([
			this.cacheService.del("chatRoomMembers", chatRoomId),
			this.cacheService.del("chatRooms", chatRoomId),
		]);

		this.events.emit("chatRoom.memberLeft", {
			userId,
			roomId: chatRoomId,
		});
	}

	/**
	 * 방의 활성 멤버 목록을 가입순으로 조회한다 — chatRoomMembers:{roomId}에 캐싱.
	 * 방 존재 검증이 factory 안에 있어 없는 방은 throw되고 캐싱되지 않는다.
	 *
	 * @param chatRoomId 대상 방 id
	 * @returns ChatRoomMemberDto 배열 (joinedAt 오름차순)
	 * @throws NotFoundException 방이 없을 때 (캐시 미스 경로에서만 검증됨)
	 */
	async getChatRoomMembers(chatRoomId: number): Promise<ChatRoomMemberDto[]> {
		return this.cacheService.getOrSet<ChatRoomMemberDto[]>(
			"chatRoomMembers",
			chatRoomId,
			async () => {
				await this.findChatRoomById(chatRoomId);
				const members =
					await this.chatRoomMemberRepository.findActiveMembers(chatRoomId);

				return Promise.all(members.map((m) => this.memberToDto(m)));
			},
		);
	}

	/**
	 * 유저가 가입한 활성 방 id 목록을 조회한다 — 연결 시 eager bulk-join용(정책 B).
	 * 방·멤버십 모두 isActive=true인 것만 포함한다(탈퇴 방 재구독 차단).
	 *
	 * @param userId 조회 대상 유저 id
	 * @returns 활성 방 id 목록 ({ id } 배열)
	 */
	async getActiveRoomIds(userId: number) {
		return this.chatRoomRepository.findActiveRoomsIdByUserId(userId);
	}

	/**
	 * 방 메시지를 sequenceNumber 커서 페이지로 조회한다. 삭제된 메시지는 content=null
	 * tombstone으로 포함된다(seq 연속성 유지 — 클라 gap 감지가 구멍으로 오인하지 않게).
	 *
	 * 첫 페이지 요청(cursor 없음 + BEFORE + limit ≤ RECENT_MESSAGES_MAX)만
	 * messages:{roomId} LIST 캐시로 서빙한다. 미스면 최신 RECENT_MESSAGES_MAX개로
	 * rebuild해 캐시를 꽉 채우고 응답은 limit만큼 자른다 — "존재하는 리스트는
	 * 완전하다" 불변식 유지. 그 외 요청(과거 페이지·AFTER)은 DB로 간다.
	 *
	 * @param userId 요청 유저 id (멤버십 검증용)
	 * @param input 페이지 입력(chatRoomId, cursor: seq, direction, limit)
	 * @returns MessageDto 배열 — BEFORE는 seq 내림차순, AFTER는 오름차순
	 * @throws ForbiddenException 방의 활성 멤버가 아닐 때
	 */
	async getMessages(
		userId: number,
		input: MessagePageInput,
	): Promise<MessageDto[]> {
		const joined = await this.chatRoomMemberRepository.existsActiveMember({
			userId,
			chatRoomId: input.chatRoomId,
		});
		if (!joined) throw new ForbiddenException("채팅방 멤버가 아닙니다.");

		const cacheable =
			input.cursor === null &&
			input.direction === MessageDirection.BEFORE &&
			input.limit <= RECENT_MESSAGES_MAX;

		if (cacheable) {
			const cached = await this.cacheService.listRange<MessageDto>(
				"messages",
				input.chatRoomId,
				input.limit,
			);
			if (cached) return cached;
		}

		const rows = await this.messageRepository.findByChatRoomId(
			cacheable ? { ...input, limit: RECENT_MESSAGES_MAX } : input,
		);
		const dtos = await Promise.all(rows.map((m) => this.messageToDto(m)));

		if (cacheable) {
			await this.cacheService.listRebuild("messages", input.chatRoomId, dtos);
			return dtos.slice(0, input.limit);
		}
		return dtos;
	}

	/**
	 * 메시지를 전송한다 — DB 채번+INSERT 후 messages:{roomId} LIST 캐시를
	 * write-through(LPUSHX+LTRIM)로 갱신하고, lastMessage가 바뀌므로 chatRooms:{roomId}
	 * blob을 무효화한다. 성공 시 message.sent 이벤트를 발행해 게이트웨이가 방 채널로
	 * 브로드캐스트한다.
	 *
	 * @param senderId 발신 유저 id
	 * @param input 전송 입력(chatRoomId, content 등)
	 * @returns 확정된 MessageDto(sequenceNumber 포함) — 게이트웨이가 ack로 내려보낸다
	 * @throws NotFoundException 방 또는 유저가 없을 때
	 * @throws ForbiddenException 방의 활성 멤버가 아닐 때
	 */
	async sendMessage(
		senderId: number,
		input: SendMessageInput,
	): Promise<MessageDto> {
		const [_chatRoom, sender, joined] = await Promise.all([
			this.findChatRoomById(input.chatRoomId),
			this.findUserById(senderId),
			this.chatRoomMemberRepository.existsActiveMember({
				userId: senderId,
				chatRoomId: input.chatRoomId,
			}),
		]);

		if (!joined) throw new ForbiddenException("채팅방 멤버가 아닙니다.");

		const row = await this.messageRepository.createInRoom(senderId, input);
		const messageDto = await this.messageToDto({ ...row, sender });

		await Promise.all([
			this.cacheService.listPushTrim<MessageDto>(
				"messages",
				input.chatRoomId,
				messageDto,
				RECENT_MESSAGES_MAX,
			),
			this.cacheService.del("chatRooms", input.chatRoomId),
		]);

		this.events.emit("message.sent", {
			roomId: input.chatRoomId,
			message: messageDto,
		});

		return messageDto;
	}
}
