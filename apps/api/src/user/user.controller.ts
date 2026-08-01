import { Body, Controller, Post } from "@nestjs/common";
import { loginSchema } from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { UserService } from "./user.service";

class LoginDto extends createZodDto(loginSchema) {}

@Controller("users")
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Post("sign-in")
	signIn(@Body() loginDto: LoginDto) {
		return this.userService.login(loginDto);
	}
}
