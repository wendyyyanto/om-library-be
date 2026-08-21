import {
	BadRequestException,
	ForbiddenException,
	HttpStatus,
	Injectable,
	InternalServerErrorException,
	NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuthenticatedUser } from "../commons/AuthTypes";
import { ERROR_CODES } from "../constants/error-codes";
import {
	roleFromId,
	userStatusFromId,
	UserRole,
	UserStatus
} from "../constants/library";
import { ProfileResponse, UpdateProfileDto } from "../dtos/ProfileDto";
import { LibraryUserEntity } from "../entities/LibraryUserEntity";

@Injectable()
export class ProfileService {
	constructor(
		@InjectRepository(LibraryUserEntity)
		private readonly users: Repository<LibraryUserEntity>
	) {}

	async getProfile(userId: string): Promise<ProfileResponse> {
		const user = await this.users.findOne({
			where: { id: userId },
			select: {
				id: true,
				name: true,
				email: true,
				roleId: true,
				statusId: true
			}
		});
		if (!user) throw this.userNotFound();

		return this.toProfileResponse(user);
	}

	async updateProfile(
		actor: AuthenticatedUser,
		dto: UpdateProfileDto
	): Promise<ProfileResponse> {
		if (this.touchesPrivilege(dto) && actor.role !== UserRole.Admin)
			throw this.forbidden();

		const patch = this.toPatch(dto);
		if (!Object.keys(patch).length) throw this.nothingToUpdate();

		const user = await this.users.findOne({ where: { id: actor.id } });
		if (!user) throw this.userNotFound();

		if (this.changesPrivilege(patch, user))
			patch.tokensValidFrom = new Date(
				Math.floor(Date.now() / 1000) * 1000
			);

		await this.users.update({ id: user.id }, patch);

		return this.toProfileResponse({ ...user, ...patch });
	}

	private touchesPrivilege(dto: UpdateProfileDto): boolean {
		return dto.role !== undefined || dto.status !== undefined;
	}

	/** `role`/`status` arrive as the reference-table ids already, validated by the DTO. */
	private toPatch(dto: UpdateProfileDto): Partial<LibraryUserEntity> {
		const patch: Partial<LibraryUserEntity> = {};
		if (dto.name !== undefined) patch.name = dto.name;
		if (dto.role !== undefined) patch.roleId = dto.role;
		if (dto.status !== undefined) patch.statusId = dto.status;
		return patch;
	}

	private changesPrivilege(
		patch: Partial<LibraryUserEntity>,
		user: LibraryUserEntity
	): boolean {
		return (
			(patch.roleId !== undefined && patch.roleId !== user.roleId) ||
			(patch.statusId !== undefined && patch.statusId !== user.statusId)
		);
	}

	private toProfileResponse(user: LibraryUserEntity): ProfileResponse {
		return {
			id: user.id,
			name: user.name,
			email: user.email,
			role: this.roleOf(user),
			status: this.statusOf(user)
		};
	}

	private roleOf(user: LibraryUserEntity): UserRole {
		const role = roleFromId(user.roleId);
		if (!role) throw this.unknownReference("role");
		return role;
	}

	private statusOf(user: LibraryUserEntity): UserStatus {
		const status = userStatusFromId(user.statusId);
		if (!status) throw this.unknownReference("status");
		return status;
	}

	private userNotFound(): NotFoundException {
		return new NotFoundException({
			statusCode: HttpStatus.NOT_FOUND,
			code: ERROR_CODES.NOT_FOUND,
			message: "Account not found."
		});
	}

	private forbidden(): ForbiddenException {
		return new ForbiddenException({
			statusCode: HttpStatus.FORBIDDEN,
			code: ERROR_CODES.FORBIDDEN,
			message: "You do not have access to this feature."
		});
	}

	private nothingToUpdate(): BadRequestException {
		return new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: ERROR_CODES.VALIDATION_FAILED,
			message: "Provide at least one field to update."
		});
	}

	private unknownReference(field: string): InternalServerErrorException {
		return new InternalServerErrorException({
			statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
			code: ERROR_CODES.INVALID_REFERENCE,
			message: `Account ${field} is not recognised. Please contact support.`
		});
	}
}
