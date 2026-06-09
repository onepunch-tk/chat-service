import { Module } from "@nestjs/common";
import { CryptoModule } from "../crypto/crypto.module";
import { UserRepository } from "./user.repository";
import { UserService } from "./user.service";

@Module({
	imports: [CryptoModule],
	providers: [UserRepository, UserService],
	exports: [UserRepository],
})
export class UserModule {}
