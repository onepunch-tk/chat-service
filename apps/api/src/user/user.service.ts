import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { SelectUser } from "@repo/db/schemas";
import {
	CreateUserInput,
	LoginInput,
	OffsetPage,
	SearchQueryInput,
	UserDto,
} from "@repo/shared-types";
import { CryptoService } from "../crypto/crypto.service";
import { UserRepository } from "./user.repository";

@Injectable()
export class UserService {
	constructor(
		private readonly userRepository: UserRepository,
		private readonly cryptoService: CryptoService,
	) {}

	async createUser(createUserInput: CreateUserInput): Promise<UserDto> {
		if (await this.userRepository.existsByUsername(createUserInput.username)) {
			throw new ConflictException(
				`이미 존재하는 사용자명입니다: ${createUserInput.username}`,
			);
		}

		const hashedPassword = await this.cryptoService.passwordHash(
			createUserInput.password,
		);
		// existsByUsername와 insert 사이 TOCTOU: 동시 가입이 선검사를 모두 통과해도
		// onConflictDoNothing이 null을 돌려주므로 동일 ConflictException으로 막는다(race 시 500 방지).
		const user = await this.userRepository.createUser({
			...createUserInput,
			password: hashedPassword,
		});
		if (!user) {
			throw new ConflictException(
				`이미 존재하는 사용자명입니다: ${createUserInput.username}`,
			);
		}

		return this.userToDto(user);
	}

	async login(loginInput: LoginInput): Promise<UserDto> {
		const user = await this.userRepository.findByUsername(loginInput.username);
		const ok = await this.cryptoService.isPasswordMatch(
			loginInput.password,
			user?.password ?? this.cryptoService.dummyHash,
		);

		if (!user || !ok)
			throw new BadRequestException(
				"사용자를 찾을 수 없거나 비밀번호가 일치하지 않습니다.",
			);

		return this.userToDto(user);
	}

	async getUserById(userId: number): Promise<UserDto> {
		const user = await this.userRepository.findByUserId(userId);
		if (!user) {
			throw new NotFoundException(`사용자를 찾을 수 없습니다: ${userId}`);
		}

		return this.userToDto(user);
	}

	async searchUsers(
		searchQueryInput: SearchQueryInput,
	): Promise<OffsetPage<UserDto>> {
		const { limit, offset } = searchQueryInput;
		const { rows, total } =
			await this.userRepository.searchUsers(searchQueryInput);

		return {
			total,
			limit,
			offset,
			items: rows.map((u) => this.userToDto(u)),
		};
	}

	async updateLastSeen(userId: number): Promise<UserDto> {
		const user = await this.userRepository.updateLastSeenAt(userId);

		if (!user)
			throw new NotFoundException(`사용자를 찾을 수 없습니다: ${userId}`);

		return this.userToDto(user);
	}

	private userToDto(user: SelectUser): UserDto {
		const { password, updatedAt, ...rest } = user;
		return {
			...rest,
			createdAt: user.createdAt.toISOString(),
			lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
		};
	}
}
