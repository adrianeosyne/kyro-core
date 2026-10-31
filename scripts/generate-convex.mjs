#!/usr/bin/env node
/**
 * Offline stand-in for `npx convex codegen`.
 *
 * The real codegen needs Convex deployment authentication ("npx convex dev"),
 * which is not always available (CI, fresh checkouts). This script emits the
 * exact same three TypeScript files Convex's own templates produce
 * (see node_modules/convex/dist/esm/cli/codegen_templates/):
 *
 *   src/convex/_generated/dataModel.ts — typed from src/convex/schema.ts
 *   src/convex/_generated/server.ts    — builders + ctx types bound to it
 *   src/convex/_generated/api.ts       — anyApi re-export plus a typed module map
 *
 * Regenerate after adding, renaming, or deleting Convex modules:
 *   npm run gen:convex
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const convexDir = path.join(root, "src", "convex");
const outDir = path.join(convexDir, "_generated");

function header(oneLineDescription) {
  return `/* eslint-disable */
/**
 * ${oneLineDescription}
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run \`npx convex dev\` (or \`npm run gen:convex\` offline).
 * @module
 */
`;
}

/** Convex's module naming rules, ported from codegen_templates/api.js. */
function moduleIdentifier(modulePath) {
  let safe = modulePath
    .replace(/\//g, "_")
    .replace(/\./g, "_")
    .replace(/-/g, "_");
  if (["fullApi", "api", "internal", "components"].includes(safe)) {
    safe = `${safe}_`;
  }
  const reserved = new Set([
    "break", "case", "catch", "class", "const", "continue", "debugger",
    "default", "delete", "do", "else", "export", "extends", "false",
    "finally", "for", "function", "if", "import", "in", "instanceof",
    "new", "null", "return", "super", "switch", "this", "throw", "true",
    "try", "typeof", "var", "void", "while", "with", "let", "static",
    "yield", "await", "enum", "implements", "interface", "package",
    "private", "protected", "public",
  ]);
  if (reserved.has(safe)) safe = `${safe}_`;
  return safe;
}

/** Every .ts module under src/convex, as "a/b/c" style paths, `_generated` skipped. */
function modulePaths() {
  const out = [];
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith("_")) continue;
      const abs = path.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, relPath);
      else if (entry.name.endsWith(".ts")) out.push(relPath.replace(/\.ts$/, ""));
    }
  };
  walk(convexDir, "");
  const collator = new Intl.Collator("en-US", { usage: "sort", sensitivity: "case" });
  return out.sort((a, b) => collator.compare(a, b));
}

const paths = modulePaths();
const typeImports = paths
  .map((p) => `import type * as ${moduleIdentifier(p)} from "../${p}.js";`)
  .join("\n");
const recordEntries = paths
  .map((p) => `  "${p}": typeof ${moduleIdentifier(p)},`)
  .join("\n");

fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, "dataModel.ts"),
  `${header("Generated data model types.")}
import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  TableNamesInDataModel,
  SystemTableNames,
} from "convex/server";
import type { GenericId } from "convex/values";
import schema from "../schema.js";

/**
 * The names of all of your Convex tables.
 */
export type TableNames = TableNamesInDataModel<DataModel>;

/**
 * The type of a document stored in Convex.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Doc<TableName extends TableNames> = DocumentByName<DataModel, TableName>;

/**
 * An identifier for a document in Convex.
 *
 * Convex documents are uniquely identified by their \`Id\`, which is accessible
 * on the \`_id\` field. To learn more, see [Document IDs](https://docs.convex.dev/using/document-ids).
 *
 * IDs are just strings at runtime, but this type can be used to distinguish them from other
 * strings when type checking.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Id<TableName extends TableNames | SystemTableNames> = GenericId<TableName>;

/**
 * A type describing your Convex data model.
 *
 * This type includes information about what tables you have, the type of
 * documents stored in those tables, and the indexes defined on them.
 *
 * This type is used to parameterize methods like \`queryGeneric\` and
 * \`mutationGeneric\` to make them type-safe.
 */
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
`,
);

fs.writeFileSync(
  path.join(outDir, "server.ts"),
  `${header("Generated utilities for implementing server-side Convex query and mutation functions.")}
import {
  actionGeneric,
  httpActionGeneric,
  queryGeneric,
  mutationGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
} from "convex/server";
import type {
  ActionBuilder,
  HttpActionBuilder,
  MutationBuilder,
  QueryBuilder,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  GenericDatabaseReader,
  GenericDatabaseWriter,
} from "convex/server";
import type { DataModel } from "./dataModel.js";

/**
 * Define a query in this Convex app's public API.
 *
 * This function will be allowed to read your Convex database and will be accessible from the client.
 *
 * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an \`export\` to name it and make it accessible.
 */
export const query: QueryBuilder<DataModel, "public"> = queryGeneric;

/**
 * Define a query that is only accessible from other Convex functions (but not from the client).
 *
 * This function will be allowed to read from your Convex database. It will not be accessible from the client.
 *
 * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an \`export\` to name it and make it accessible.
 */
export const internalQuery: QueryBuilder<DataModel, "internal"> = internalQueryGeneric;

/**
 * Define a mutation in this Convex app's public API.
 *
 * This function will be allowed to modify your Convex database and will be accessible from the client.
 *
 * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an \`export\` to name it and make it accessible.
 */
export const mutation: MutationBuilder<DataModel, "public"> = mutationGeneric;

/**
 * Define a mutation that is only accessible from other Convex functions (but not from the client).
 *
 * This function will be allowed to modify your Convex database. It will not be accessible from the client.
 *
 * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an \`export\` to name it and make it accessible.
 */
export const internalMutation: MutationBuilder<DataModel, "internal"> = internalMutationGeneric;

/**
 * Define an action in this Convex app's public API.
 *
 * An action is a function which can execute any JavaScript code, including non-deterministic
 * code and code with side-effects, like calling third-party services.
 * They can be run in Convex's JavaScript environment or in Node.js using the "use node" directive.
 * They can interact with the database indirectly by calling queries and mutations using the {@link ActionCtx}.
 *
 * @param func - The action. It receives an {@link ActionCtx} as its first argument.
 * @returns The wrapped action. Include this as an \`export\` to name it and make it accessible.
 */
export const action: ActionBuilder<DataModel, "public"> = actionGeneric;

/**
 * Define an action that is only accessible from other Convex functions (but not from the client).
 *
 * @param func - The function. It receives an {@link ActionCtx} as its first argument.
 * @returns The wrapped action. Include this as an \`export\` to name it and make it accessible.
 */
export const internalAction: ActionBuilder<DataModel, "internal"> = internalActionGeneric;

/**
 * Define an HTTP action.
 *
 * The wrapped function will be used to respond to HTTP requests received
 * by a Convex deployment if the requests matches the path and method where
 * this action is routed. Be sure to route your httpAction in \`convex/http.js\`.
 *
 * @param func - The function. It receives an {@link ActionCtx} as its first argument
 * and a Fetch API \`Request\` object as its second.
 * @returns The wrapped function. Import this function from \`convex/http.js\` and route it to hook it up.
 */
export const httpAction: HttpActionBuilder = httpActionGeneric;

/**
 * Typesafe environment variables.
 *
 * This includes platform-provided env vars and any variables declared in
 * \`convex.config.ts\`.
 */
export const env: Record<string, string | undefined> = (
  globalThis as unknown as { process: { env: Record<string, string | undefined> } }
).process.env;

/**
 * A set of services for use within Convex query functions.
 *
 * The query context is passed as the first argument to any Convex query
 * function run on the server.
 *
 * This differs from the {@link MutationCtx} because all of the services are
 * read-only.
 */
export type QueryCtx = GenericQueryCtx<DataModel>;

/**
 * A set of services for use within Convex mutation functions.
 *
 * The mutation context is passed as the first argument to any Convex mutation
 * function run on the server.
 */
export type MutationCtx = GenericMutationCtx<DataModel>;

/**
 * A set of services for use within Convex action functions.
 *
 * The action context is passed as the first argument to any Convex action
 * function run on the server.
 */
export type ActionCtx = GenericActionCtx<DataModel>;

/**
 * An interface to read from the database within Convex query functions.
 *
 * The two entry points are {@link DatabaseReader.get}, which fetches a single
 * document by its {@link Id}, or {@link DatabaseReader.query}, which starts
 * building a query.
 */
export type DatabaseReader = GenericDatabaseReader<DataModel>;

/**
 * An interface to read from and write to the database within Convex mutation
 * functions.
 *
 * Convex guarantees that all writes within a single mutation are
 * executed atomically, so you never have to worry about partial writes leaving
 * your data in an inconsistent state. See [the Convex Guide](https://docs.convex.dev/understanding/convex-fundamentals/functions#atomicity-and-optimistic-concurrency-control)
 * for the guarantees Convex provides your functions.
 */
export type DatabaseWriter = GenericDatabaseWriter<DataModel>;
`,
);

fs.writeFileSync(
  path.join(outDir, "api.ts"),
  `${header("Generated \`api\` utility.")}
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import { anyApi } from "convex/server";
${typeImports}

const fullApi: ApiFromModules<{
${recordEntries}
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * \`\`\`js
 * const myFunctionReference = api.myModule.myFunction;
 * \`\`\`
 */
export const api: FilterApi<typeof fullApi, FunctionReference<any, "public">> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * \`\`\`js
 * const myFunctionReference = internal.myModule.myFunction;
 * \`\`\`
 */
export const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">> = anyApi as any;
`,
);

console.log(
  `Generated src/convex/_generated/{api,server,dataModel}.ts from ${paths.length} modules.`,
);
