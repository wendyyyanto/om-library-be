import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule, JwtModuleOptions } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import type * as jwt from "jsonwebtoken";
import { JwtAuthGuard } from "../commons/JwtAuthGuard";
import { RolesGuard } from "../commons/RolesGuard";
import { AuthController } from "../controllers/AuthController";
import { LibraryUserEntity } from "../entities/LibraryUserEntity";
import { AuthService } from "../services/AuthService";
import { PasswordHasher } from "../utilities/PasswordHasher";
@Global()
@Module({
	imports: [
		TypeOrmModule.forFeature([LibraryUserEntity]),
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService): JwtModuleOptions => {
				const secret = config.get<string>("JWT_SECRET");
				if (!secret)
					throw new Error(
						"JWT_SECRET is not set — refusing to start with an unsigned auth layer"
					);
				return {
					secret,
					signOptions: {
						expiresIn: (config.get<string>("JWT_EXPIRES_IN") ??
							"7d") as jwt.SignOptions["expiresIn"]
					}
				};
			}
		})
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		PasswordHasher,
		RolesGuard,
		{ provide: APP_GUARD, useClass: JwtAuthGuard }
	],
	exports: [JwtModule, PasswordHasher, RolesGuard]
})
export class AuthModule {}
