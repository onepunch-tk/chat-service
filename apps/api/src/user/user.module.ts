import { Module } from "@nestjs/common";
import { CryptoModule } from "../crypto/crypto.module";
import { UserRepository } from "./user.repository";

@Module({
	imports: [CryptoModule],
	providers: [UserRepository],
})
export class UserModule {}
