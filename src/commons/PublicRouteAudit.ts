import { INestApplication } from "@nestjs/common";
import { PATH_METADATA } from "@nestjs/common/constants";
import { DiscoveryService, Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./Public";

const ALLOWED_PUBLIC_ROUTES: ReadonlySet<string> = new Set([
	"AppController.health",
	"AuthController.login",
	"AuthController.register"
]);

export function assertNoUnexpectedPublicRoutes(app: INestApplication): void {
	const reflector = app.get(Reflector);
	const offenders: string[] = [];

	for (const wrapper of app.get(DiscoveryService).getControllers()) {
		const controller = wrapper.metatype;
		if (!wrapper.instance || !controller) continue;

		const prototype = Object.getPrototypeOf(wrapper.instance) as object;
		for (const method of Object.getOwnPropertyNames(prototype)) {
			if (method === "constructor") continue;

			const handler = (prototype as Record<string, unknown>)[method];
			// Only route handlers carry PATH_METADATA — skip plain helper methods.
			if (
				typeof handler !== "function" ||
				Reflect.getMetadata(PATH_METADATA, handler) === undefined
			)
				continue;

			const isPublic = reflector.getAllAndOverride<boolean>(
				IS_PUBLIC_KEY,
				[handler, controller]
			);
			const route = `${controller.name}.${method}`;
			if (isPublic && !ALLOWED_PUBLIC_ROUTES.has(route))
				offenders.push(route);
		}
	}

	if (offenders.length)
		throw new Error(
			`Refusing to start: ${offenders.length} route(s) are @Public() but not on the ` +
				`allowlist in PublicRouteAudit.ts — ${offenders.sort().join(", ")}. ` +
				`Remove @Public(), or add the route to ALLOWED_PUBLIC_ROUTES if exposing it is intended.`
		);
}
