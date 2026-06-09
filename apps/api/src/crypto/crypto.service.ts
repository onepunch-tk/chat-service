import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";

@Injectable()
export class CryptoService {
	async passwordHash(password: string, saltRounds = 10): Promise<string> {
		return bcrypt.hash(password, saltRounds);
	}

	async isPasswordMatch(password: string, hash: string): Promise<boolean> {
		return bcrypt.compare(password, hash);
	}
}
