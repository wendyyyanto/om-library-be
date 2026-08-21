import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { UserRole } from "../constants/library";

export class RegisterDto {
	@IsEmail({}, { message: "Invalid email format!" })
	@MaxLength(255, { message: "Email must be less than 255 characters!" })
	@Transform(({ value }) =>
		typeof value === "string" ? value.trim().toLowerCase() : value
	)
	email: string;

	@IsString({ message: "Password is required!" })
	@MinLength(6, { message: "Password must be at least 6 characters!" })
	@MaxLength(72, { message: "Password must be less than 72 characters!" })
	password: string;

	@IsString({ message: "Name is required!" })
	@MinLength(2, { message: "Name must be at least 2 characters!" })
	@MaxLength(255, { message: "Name must be less than 255 characters!" })
	@Transform(({ value }) =>
		typeof value === "string" ? value.trim() : value
	)
	name: string;
}

export class LoginDto {
	@IsEmail({}, { message: "Invalid email format!" })
	@MaxLength(255, { message: "Email must be less than 255 characters!" })
	@Transform(({ value }) =>
		typeof value === "string" ? value.trim().toLowerCase() : value
	)
	email: string;

	@IsString({ message: "Password is required!" })
	@MaxLength(72, { message: "Password must be less than 72 characters!" })
	password: string;
}

export interface UserResponse {
	id: string;
	name: string;
	email: string;
	role: UserRole;
}

export interface AuthResponse {
	user: UserResponse;
	accessToken: string;
}
