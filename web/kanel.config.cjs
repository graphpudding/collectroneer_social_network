// Generates row types from the live schema: `pnpm db:types` after every migration.
const { makePgTsGenerator } = require("kanel");

module.exports = {
  connection: process.env.DATABASE_URL,
  schemaNames: ["public"],
  outputPath: "./shared/types/db",
  preDeleteOutputFolder: true,
  typescriptConfig: { enumStyle: "literal-union", tsModuleFormat: "esm" },
  generators: [
    // Tables only: the trigger and search helper functions have no use in app code.
    makePgTsGenerator({
      filter: (t) => t.kind === "table" && t.name !== "schema_migrations",
    }),
  ],
};
