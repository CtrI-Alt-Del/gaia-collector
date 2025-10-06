export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"header-pattern": [2, "always", /^(\w+): #(\d+)\s(.{1,50})$/],

		"type-case": [2, "always", "lower-case"],

		"type-enum": [
			2,
			"always",
			["feat", "fix", "docs", "style", "refactor", "test", "chore", "ci"],
		],
	},
};
