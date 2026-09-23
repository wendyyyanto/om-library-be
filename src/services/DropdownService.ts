import { BadRequestException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, ObjectLiteral, SelectQueryBuilder } from "typeorm";
import {
	DROPDOWN_RESOURCES,
	DropdownResource
} from "../constants/dropdown";
import { ERROR_CODES } from "../constants/error-codes";
import {
	DropdownFilterDto,
	DropdownOption,
	DropdownRequestDto,
	DropdownResponse,
	PaginatedDropdownResponse
} from "../dtos/DropdownDto";
import { DEFAULT_LIMIT, DEFAULT_PAGE } from "../dtos/PaginationDto";

type ScalarFilterValue = string | number | boolean;
type SortDirection = "ASC" | "DESC";
type SortEntry = [string, SortDirection];

const SQL_OPERATORS = {
	like: "LIKE",
	eq: "=",
	ne: "<>",
	gt: ">",
	gte: ">=",
	lt: "<",
	lte: "<="
} as const;

@Injectable()
export class DropdownService {
	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	async getOptions(
		dto: DropdownRequestDto
	): Promise<DropdownResponse | PaginatedDropdownResponse> {
		const resource = this.resource(dto.entity);
		const idColumn = this.column(resource, dto.attributes[0]);
		const nameColumn = this.column(resource, dto.attributes[1]);
		const query = this.dataSource
			.createQueryBuilder()
			.from(resource.table, "dropdown");

		this.applyFilters(query, resource, dto.filters ?? []);

		const rowsQuery = query
			.clone()
			.select(`dropdown.${idColumn}`, "id")
			.addSelect(`dropdown.${nameColumn}`, "name")
			.distinct(true);

		const sorting = this.sorting(dto.sort_by);
		if (sorting.length === 0) {
			rowsQuery
				.addOrderBy(
					`dropdown.${this.column(resource, resource.defaultSort)}`,
					"ASC"
				)
				.addOrderBy(`dropdown.${idColumn}`, "ASC");
		} else {
			for (const [key, direction] of sorting)
				rowsQuery.addOrderBy(
					`dropdown.${this.column(resource, key)}`,
					direction
				);
		}

		if (dto.is_paginated !== 1)
			return { data: await rowsQuery.getRawMany<DropdownOption>() };

		const page = dto.page ?? DEFAULT_PAGE;
		const limit = dto.limit ?? DEFAULT_LIMIT;
		const countQuery = query
			.clone()
			.select(`COUNT(DISTINCT dropdown.${idColumn})`, "count");
		const [countRow, rows] = await Promise.all([
			countQuery.getRawOne<{ count: string | number }>(),
			rowsQuery
				.skip((page - 1) * limit)
				.take(limit)
				.getRawMany<DropdownOption>()
		]);
		const totalItems = Number(countRow?.count ?? 0);

		return {
			data: rows,
			pagination: {
				page,
				limit,
				total_items: totalItems,
				total_pages: Math.ceil(totalItems / limit)
			}
		};
	}

	private resource(entity: string): DropdownResource {
		if (!Object.hasOwn(DROPDOWN_RESOURCES, entity))
			throw this.invalid(`Dropdown entity "${entity}" is not allowed.`);
		const resource = DROPDOWN_RESOURCES[entity];
		return resource;
	}

	private column(resource: DropdownResource, key: string): string {
		if (!Object.hasOwn(resource.columns, key))
			throw this.invalid(`Dropdown attribute "${key}" is not allowed.`);
		return resource.columns[key];
	}

	private applyFilters(
		query: SelectQueryBuilder<ObjectLiteral>,
		resource: DropdownResource,
		filters: DropdownFilterDto[]
	): void {
		filters.forEach((filter, index) => {
			const identifier = `dropdown.${this.column(resource, filter.key)}`;
			const parameter = `dropdown_filter_${index}`;
			const condition = this.condition(identifier, parameter, filter);
			const parameters = this.parameters(parameter, filter);

			if (index === 0) query.where(condition, parameters);
			else if (filter.logical === "or") query.orWhere(condition, parameters);
			else query.andWhere(condition, parameters);
		});
	}

	private condition(
		identifier: string,
		parameter: string,
		filter: DropdownFilterDto
	): string {
		if (filter.operator === "in") {
			if (!this.isScalarArray(filter.value))
				throw this.invalid("The in operator requires 1 to 100 scalar values.");
			return `${identifier} IN (:...${parameter})`;
		}

		if (filter.operator === "is" || filter.operator === "is_not") {
			if (filter.value !== null)
				throw this.invalid("The is and is_not operators only accept null.");
			return `${identifier} ${filter.operator === "is" ? "IS" : "IS NOT"} NULL`;
		}

		if (filter.operator === "like" && typeof filter.value !== "string")
			throw this.invalid("The like operator requires a text value.");

		if (!this.isScalar(filter.value))
			throw this.invalid(
				`The ${filter.operator} operator requires a scalar value.`
			);

		return `${identifier} ${SQL_OPERATORS[filter.operator]} :${parameter}`;
	}

	private parameters(
		parameter: string,
		filter: DropdownFilterDto
	): Record<string, unknown> {
		return filter.operator === "is" || filter.operator === "is_not"
			? {}
			: { [parameter]: filter.value };
	}

	private sorting(value: unknown): SortEntry[] {
		if (value === undefined) return [];
		if (!Array.isArray(value))
			throw this.invalid("sort_by must be an array of [attribute, direction].");

		const entries = typeof value[0] === "string" ? [value] : value;
		if (entries.length > 5)
			throw this.invalid("At most 5 sort fields are allowed.");

		return entries.map((entry) => {
			if (!Array.isArray(entry) || entry.length !== 2)
				throw this.invalid(
					"Every sort field must contain an attribute and direction."
				);

			const [key, rawDirection] = entry;
			if (typeof key !== "string" || key.trim().length === 0)
				throw this.invalid("Every sort attribute must be text.");
			if (typeof rawDirection !== "string")
				throw this.invalid("Every sort direction must be asc or desc.");

			const direction = rawDirection.toUpperCase();
			if (direction !== "ASC" && direction !== "DESC")
				throw this.invalid("Every sort direction must be asc or desc.");

			return [key.trim(), direction] as SortEntry;
		});
	}

	private isScalar(value: unknown): value is ScalarFilterValue {
		return (
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean"
		);
	}

	private isScalarArray(value: unknown): value is ScalarFilterValue[] {
		return (
			Array.isArray(value) &&
			value.length >= 1 &&
			value.length <= 100 &&
			value.every((item) => this.isScalar(item))
		);
	}

	private invalid(message: string): BadRequestException {
		return new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: ERROR_CODES.VALIDATION_FAILED,
			message
		});
	}
}
