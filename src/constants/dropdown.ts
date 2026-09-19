export interface DropdownResource {
	table: string;
	columns: Readonly<Record<string, string>>;
	defaultSort: string;
}

export const DROPDOWN_RESOURCES: Readonly<Record<string, DropdownResource>> = {
	teaching_events: {
		table: "teaching_events",
		columns: { id: "id", name: "name" },
		defaultSort: "name"
	},
	teachers: {
		table: "teachers",
		columns: { id: "id", name: "name" },
		defaultSort: "name"
	},
	years: {
		table: "years",
		columns: { id: "id", year: "year" },
		defaultSort: "year"
	},
	books: {
		table: "books",
		columns: {
			id: "id",
			bookName: "bookName",
			totalChapters: "totalChapters"
		},
		defaultSort: "bookName"
	},
	class_categories: {
		table: "class_categories",
		columns: { id: "id", label: "label" },
		defaultSort: "label"
	},
	ebook_tags: {
		table: "ebook_tags",
		columns: { id: "id", label: "label" },
		defaultSort: "label"
	},
	library_roles: {
		table: "library_roles",
		columns: { id: "id", name: "name" },
		defaultSort: "name"
	},
	library_statuses: {
		table: "library_statuses",
		columns: { id: "id", name: "name" },
		defaultSort: "name"
	}
};
