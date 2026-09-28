import {
	ConflictException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { isEmail } from "class-validator";
import { randomUUID } from "node:crypto";
import { QueryFailedError, Repository } from "typeorm";
import { MYSQL_ERROR } from "../constants/error-codes";
import {
	MobileApprovalStatus,
	MobileUserEntity
} from "../entities/MobileUserEntity";

export type MobileVerifyResult =
	| { ok: true; user: MobileUserEntity; token: string }
	| { ok: false; status: number; message: string };

const escapeHtml = (value: unknown): string =>
	String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");

/**
 * Mirrors the mobile API's magic-link auth (`Platform: Mobile`): register → admin approval →
 * login emails a link → `/auth/verify` hands the JWT to the app via deep link. Response bodies
 * match the mobile API so the app keeps one parse path.
 */
@Injectable()
export class MobileAuthService {
	private readonly logger = new Logger(MobileAuthService.name);
	// Own JwtService: the module-level one carries the website secret and a 30m default expiry.
	private readonly jwt: JwtService;

	constructor(
		@InjectRepository(MobileUserEntity)
		private readonly users: Repository<MobileUserEntity>,
		private readonly config: ConfigService
	) {
		const secret = this.config.get<string>("MOBILE_JWT_SECRET");
		if (!secret)
			throw new Error(
				"MOBILE_JWT_SECRET is not set — refusing to start with an unsigned mobile auth layer"
			);
		this.jwt = new JwtService({ secret });
	}

	async register(body: Record<string, unknown>): Promise<{ message: string }> {
		const name = typeof body.name === "string" ? body.name.trim() : "";
		const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
		if (!name || !isEmail(email))
			throw new HttpException({ message: "name and email must be filled" }, HttpStatus.BAD_REQUEST);

		if (await this.users.exists({ where: { email } })) throw this.emailTaken();
		try {
			await this.users.insert({ name, email, approvalStatus: MobileApprovalStatus.Pending });
		} catch (error) {
			if (
				error instanceof QueryFailedError &&
				(error.driverError as { errno?: number } | undefined)?.errno === MYSQL_ERROR.DUP_ENTRY
			)
				throw this.emailTaken();
			throw error;
		}

		return {
			message: "Registration success, waiting for admin approval before you can log in"
		};
	}

	async login(body: Record<string, unknown>): Promise<{ message: string }> {
		const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
		if (!isEmail(email))
			throw new HttpException({ message: "email must be filled" }, HttpStatus.BAD_REQUEST);

		const user = await this.users.findOne({ where: { email } });
		if (!user) throw new NotFoundException({ message: "Email not found" });
		if (user.approvalStatus === MobileApprovalStatus.Pending)
			throw new ForbiddenException({ message: "Your account is not approved by admin yet" });
		if (user.approvalStatus === MobileApprovalStatus.Rejected)
			throw new ForbiddenException({ message: "Your account registration has been rejected" });
		if (user.approvalStatus !== MobileApprovalStatus.Approved)
			throw new ForbiddenException({ message: "Your account has an invalid approval status" });

		const expiresIn = this.config.get<string>("MOBILE_JWT_EXPIRES_IN");
		const token = await this.jwt.signAsync(
			{ id: user.id, email: user.email, name: user.name },
			{ jwtid: randomUUID(), ...(expiresIn ? { expiresIn: expiresIn as never } : {}) }
		);
		await this.users.update({ id: user.id }, { token });

		const baseUrl = (this.config.get<string>("API_BASE_URL") ?? "").replace(/\/+$/, "");
		try {
			await this.sendMagicLink(email, `${baseUrl}/v1/auth/verify?token=${encodeURIComponent(token)}`);
		} catch (error) {
			this.logger.error(`Failed to send login link: ${(error as Error).message}`);
			throw new InternalServerErrorException({ message: "Failed to send login link" });
		}

		return { message: "Link has been sent to your email" };
	}

	async verify(token: string): Promise<MobileVerifyResult> {
		try {
			await this.jwt.verifyAsync(token);
		} catch {
			return { ok: false, status: 400, message: "Link masuk tidak valid atau kedaluwarsa" };
		}

		const user = await this.users.findOne({ where: { token } });
		if (!user) return { ok: false, status: 400, message: "Link masuk tidak valid" };
		if (user.approvalStatus === MobileApprovalStatus.Pending)
			return { ok: false, status: 403, message: "Akun Anda belum disetujui admin" };
		if (user.approvalStatus === MobileApprovalStatus.Rejected)
			return { ok: false, status: 403, message: "Pendaftaran akun Anda telah ditolak" };
		if (user.approvalStatus !== MobileApprovalStatus.Approved)
			return { ok: false, status: 403, message: "Status persetujuan akun tidak valid" };

		return { ok: true, user, token };
	}

	/** Where `/auth/verify` sends the app, or a debug page when `AUTH_DEBUG_MODE=true`. */
	verifiedResponse(user: MobileUserEntity, token: string): { redirect: string } | { html: string } {
		if (this.config.get<string>("AUTH_DEBUG_MODE") === "true")
			return {
				html: `<!DOCTYPE html>
<html>
<head><title>Login Debug</title></head>
<body style="font-family: sans-serif; padding: 24px;">
  <h2>✅ Login berhasil</h2>
  <p><strong>User:</strong> ${escapeHtml(user.name)} (${escapeHtml(user.email)})</p>
  <p><strong>JWT:</strong></p>
  <textarea readonly style="width:100%;height:80px;">${escapeHtml(token)}</textarea>
</body>
</html>`
			};

		const scheme = this.config.get<string>("APP_DEEP_LINK_SCHEME") || "ommobileapp://auth";
		return { redirect: `${scheme}?token=${encodeURIComponent(token)}` };
	}

	private async sendMagicLink(to: string, magicLink: string): Promise<void> {
		const apiKey = this.config.get<string>("RESEND_API_KEY");
		if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"User-Agent": "om-library-be/1.0"
			},
			body: JSON.stringify({
				from: this.config.get<string>("MAIL_FROM") || "OM Mobile App <onboarding@resend.dev>",
				to: [to],
				subject: "Login Link - OM Mobile App",
				html: `
          <p>Halo,</p>
          <p>Klik tombol di bawah ini untuk masuk ke OM Mobile App:</p>
          <p><a href="${magicLink}" style="display:inline-block;padding:10px 20px;background:#2b6cb0;color:#fff;text-decoration:none;border-radius:4px;">Masuk ke Aplikasi</a></p>
          <p>Atau salin link berikut ke browser Anda:</p>
          <p>${magicLink}</p>
        `
			})
		});

		if (!response.ok)
			throw new Error(`Resend request failed with status ${response.status}: ${await response.text()}`);
	}

	private emailTaken(): ConflictException {
		return new ConflictException({ message: "Email already registered" });
	}
}
