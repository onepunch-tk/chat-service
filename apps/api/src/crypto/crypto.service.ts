import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";

@Injectable()
export class CryptoService {
	/**
	 * 존재하지 않는 사용자로 로그인 시도 시 bcrypt.compare를 건너뛰면
	 * 응답 시간 차이로 username 존재 여부가 노출된다(timing enumeration).
	 * 실제 해시와 동일한 cost factor(10)로 미리 계산한 더미 해시와 비교해 시간을 평탄화한다.
	 */
	readonly dummyHash = bcrypt.hashSync("timing-safe-dummy", 10);

	async passwordHash(password: string, saltRounds = 10): Promise<string> {
		return bcrypt.hash(password, saltRounds);
	}

	async isPasswordMatch(password: string, hash: string): Promise<boolean> {
		return bcrypt.compare(password, hash);
	}
}
