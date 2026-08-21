export const LIBRARY_CONSTANTS = {
	maxActiveLendings: 2,
	defaultLendingDays: 14
} as const;

export enum UserRole {
	Member = "member",
	Admin = "admin"
}

/** Mirrors the `library_statuses` rows — `library_users.status_id` points at one of these. */
export enum UserStatus {
	Active = "active",
	Inactive = "inactive"
}

export const ROLE_IDS: Record<UserRole, number> = {
	[UserRole.Member]: 1,
	[UserRole.Admin]: 2
};

/** `library_statuses.id` per status. Same seeded-id contract as {@link ROLE_IDS}. */
export const USER_STATUS_IDS: Record<UserStatus, number> = {
	[UserStatus.Active]: 1,
	[UserStatus.Inactive]: 2
};

/** The `library_roles.id` values a client may send, derived so a new role needs no DTO edit. */
export const ROLE_ID_VALUES: readonly number[] = Object.values(ROLE_IDS);

/** Same contract as {@link ROLE_ID_VALUES}, for `library_statuses.id`. */
export const USER_STATUS_ID_VALUES: readonly number[] =
	Object.values(USER_STATUS_IDS);

const ROLE_BY_ID = new Map<number, UserRole>(
	Object.values(UserRole).map((role) => [ROLE_IDS[role], role])
);

const USER_STATUS_BY_ID = new Map<number, UserStatus>(
	Object.values(UserStatus).map((status) => [USER_STATUS_IDS[status], status])
);

/** `undefined` for an id this build has no role for — a `library_roles` row added since deploy. */
export const roleFromId = (id: number): UserRole | undefined =>
	ROLE_BY_ID.get(id);

/** `undefined` for an id this build has no status for. */
export const userStatusFromId = (id: number): UserStatus | undefined =>
	USER_STATUS_BY_ID.get(id);

/** Mirrors the `library_lending.status` ENUM. */
export enum LendingStatus {
	Pending = "pending",
	Approved = "approved",
	Rejected = "rejected",
	ReturnRequested = "return_requested",
	Returned = "returned"
}

/** Mirrors the `library_book_copies.status` ENUM. */
export enum CopyStatus {
	Available = "available",
	Borrowed = "borrowed",
	Damaged = "damaged",
	Lost = "lost"
}

/** Mirrors the `library_damage_claims.status` ENUM. */
export enum DamageClaimStatus {
	Pending = "pending",
	Paid = "paid",
	Waived = "waived"
}

export const ACTIVE_LENDING_STATUSES: readonly LendingStatus[] = [
	LendingStatus.Approved
];

/** `GET /lendings/me?tab=active` — what a member considers an open loan. */
export const MEMBER_ACTIVE_TAB_STATUSES: readonly LendingStatus[] = [
	LendingStatus.Pending,
	LendingStatus.Approved,
	LendingStatus.ReturnRequested
];

/** `GET /lendings/me?tab=history`. */
export const MEMBER_HISTORY_TAB_STATUSES: readonly LendingStatus[] = [
	LendingStatus.Rejected,
	LendingStatus.Returned
];

/** BR-8 — copy lending history shows only completed/active borrows. */
export const COPY_HISTORY_STATUSES: readonly LendingStatus[] = [
	LendingStatus.Approved,
	LendingStatus.ReturnRequested,
	LendingStatus.Returned
];
