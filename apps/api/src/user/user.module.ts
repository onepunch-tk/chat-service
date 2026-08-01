import { Module } from "@nestjs/common";
import { CryptoModule } from "../crypto/crypto.module";
import { UserRepository } from "./user.repository";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";

@Module({
	imports: [CryptoModule],
	providers: [UserRepository, UserService],
	exports: [UserRepository],
	controllers: [UserController],
})
export class UserModule {}
