# Project Context

## {{project_name}}
{{project_description}}

## Expected Workflow
You should frequently lint and typecheck. You can liberally use `bun run lint:fix` because our linter is very strict. NEVER consider a task complete unless we are passing linting and typechecking. If you have made many attempts to fix a linting or typechecking error, you can stop and ask for help. Be very clear about the solutions you attempted.

## Project Structure

### Repo Structure
```
brsr/
├── src/                          # React application source
│   ├── assets/                   # Static assets
│   ├── components/               # React components
│   ├── hooks/                    # Custom React hooks
│   ├── app.tsx                   # Main React app component
│   ├── main.tsx                  # Application entry point
│   ├── styles.css                # Global styles (Tailwind CSS v4)
│   ├── types.ts                  # TypeScript type definitions
│   └── vite-env.d.ts             # Vite environment types
├── src-tauri/                    # Tauri backend (Rust)
│   ├── capabilities/             # Tauri capability configs
│   ├── gen/                      # Generated Tauri bindings
│   ├── icons/                    # Application icons
│   ├── src/                      # Rust source code
│   ├── target/                   # Rust build output
│   ├── build.rs                  # Build script
│   ├── Cargo.toml                # Rust dependencies
│   ├── Cargo.lock                # Rust lockfile
│   └── tauri.conf.json           # Tauri configuration
├── dist/                         # Production build output
├── public/                       # Static public assets
├── biome.jsonc                   # Linter/formatter config
├── lefthook.yml                  # Git hooks
├── package.json                  # Node dependencies & scripts
├── bun.lock                      # Bun lockfile
├── tsconfig.json                 # TypeScript config
├── tsconfig.app.json             # App-specific TS config
├── tsconfig.node.json            # Node-specific TS config
├── vite.config.ts                # Vite bundler config
└── index.html                    # HTML entry point
```

### Available Scripts

#### Scripts
- `bun run dev` - Start Vite dev server (web only)
- `bun run build` - Build the web app with TypeScript checking
- `bun run preview` - Preview the production build
- `bun run tauri:dev` - Start the Tauri desktop app in development mode
- `bun run tauri:build` - Build the Tauri desktop app for production
- `bun run lint` - Run linting checks
- `bun run lint:fix` - Auto-fix linting issues
- `bun run lint:fix:unsafe` - Auto-fix with unsafe rules
- `bun run typecheck` - Type-check all TypeScript files
- `bun run clean` - Remove node_modules, dist, and Rust target directories

## Package Management

### Bun Package Manager
This project uses Bun as the package manager. Dependencies are managed in a single `package.json` file with exact version pinning for reproducible builds.

### Adding Dependencies
When adding new dependencies:
- Use `bun add [package]` for runtime dependencies
- Use `bun add -d [package]` for development dependencies
- Always use exact versions (no ^ or ~ prefixes) for consistency

## Linting and Typechecking
We use Ultracite, a preset for Biome's lightning fast formatter and linter, which enforces strict type safety, accessibility standards, and consistent code quality for TypeScript projects.

### Before Writing Code
1. Analyze existing patterns in the codebase
2. Consider edge cases and error scenarios
3. Follow the rules below strictly

### Biome / Ultracite Linting Rules

#### Accessibility (a11y)
- Make sure label elements have text content and are associated with an input.
- Give all elements requiring alt text meaningful information for screen readers.
- Always include a `type` attribute for button elements.
- Accompany `onClick` with at least one of: `onKeyUp`, `onKeyDown`, or `onKeyPress`.
- Accompany `onMouseOver`/`onMouseOut` with `onFocus`/`onBlur`.
- Use semantic elements instead of role attributes in JSX.

#### Code Complexity and Quality
- Don't use any or unknown as type constraints.
- Don't use primitive type aliases or misleading types.
- Don't use empty type parameters in type aliases and interfaces.
- Don't write functions that exceed a given Cognitive Complexity score.
- Don't nest describe() blocks too deeply in test files.
- Use for...of statements instead of Array.forEach.
- Don't use unnecessary nested block statements.
- Don't rename imports, exports, and destructured assignments to the same name.
- Don't use unnecessary string or template literal concatenation.
- Don't use useless case statements in switch statements.
- Don't use ternary operators when simpler alternatives exist.
- Don't initialize variables to undefined.
- Use arrow functions instead of function expressions.
- Use Date.now() to get milliseconds since the Unix Epoch.
- Use .flatMap() instead of map().flat() when possible.
- Use concise optional chaining instead of chained logical expressions.
- Remove redundant terms from logical expressions.
- Use while loops instead of for loops when you don't need initializer and update expressions.
- Don't pass children as props.
- Don't declare functions and vars that are accessible outside their block.
- Don't use variables and function parameters before they're declared.

#### React and JSX Best Practices
- Don't use the return value of React.render.
- Make sure all dependencies are correctly specified in React hooks.
- Make sure all React hooks are called from the top level of component functions.
- Don't forget key props in iterators and collection literals.
- Don't define React components inside other components.
- Don't use dangerous JSX props.
- Don't use Array index in keys.
- Don't insert comments as text nodes.
- Don't assign JSX properties multiple times.
- Don't add extra closing tags for components without children.
- Use `<>...</>` instead of `<Fragment>...</Fragment>`.
- Watch out for possible "wrong" semicolons inside JSX elements.

#### Correctness and Safety
- Don't write unreachable code.
- Don't use optional chaining where undefined values aren't allowed.
- Don't have unused function parameters.
- Don't have unused imports.
- Don't have unused labels.
- Don't have unused variables.
- Make sure typeof expressions are compared to valid values.
- Make sure generator functions contain yield.
- Don't use await inside loops. If running sequence-dependent async operations, build a promise chain.
- Make sure Promise-like statements are handled appropriately.
- Don't use __dirname and __filename in the global scope.
- Prevent import cycles.
- Don't use configured elements.
- Don't hardcode sensitive data like API keys and tokens.
- Don't let variable declarations shadow variables from outer scopes.
- Don't use the TypeScript directive @ts-ignore.
- Don't use useless undefined.
- Make sure switch-case statements are exhaustive.
- Use `Array#{indexOf,lastIndexOf}()` instead of `Array#{findIndex,findLastIndex}()` when looking for the index of an item.
- Make sure iterable callbacks return consistent values.
- Use object spread instead of `Object.assign()` when constructing new objects.
- Always use the radix argument when using `parseInt()`.
- Make sure JSDoc comment lines start with a single asterisk, except for the first one.
- Don't use spread (`...`) syntax on accumulators.
- Don't use namespace imports.
- Declare regex literals at the top level.

#### TypeScript Best Practices
- Don't use TypeScript enums.
- Don't export imported variables.
- Don't use TypeScript namespaces.
- Don't use non-null assertions with the `!` postfix operator.
- Don't use user-defined types.
- Use `as const` instead of literal types and type annotations.
- Use either `T[]` or `Array<T>` consistently.
- Initialize each enum member value explicitly.
- Use `export type` for types.
- Use `import type` for types.
- Make sure all enum members are literal values.
- Don't use TypeScript const enum.
- Don't declare empty interfaces.
- Don't let variables evolve into any type through reassignments.
- Don't use the any type.
- Don't misuse the non-null assertion operator (!) in TypeScript files.
- Don't use implicit any type on variable declarations.

#### Style and Consistency
- Don't use callbacks in asynchronous tests and hooks.
- Don't use negation in `if` statements that have `else` clauses.
- Don't use nested ternary expressions.
- Don't reassign function parameters.
- Use `String.slice()` instead of `String.substr()` and `String.substring()`.
- Don't use template literals if you don't need interpolation or special-character handling.
- Don't use `else` blocks when the `if` block breaks early.
- Use `at()` instead of integer index access.
- Follow curly brace conventions.
- Use `else if` instead of nested `if` statements in `else` clauses.
- Use single `if` statements instead of nested `if` clauses.
- Use `new` for all builtins except `String`, `Number`, and `Boolean`.
- Use consistent accessibility modifiers on class properties and methods.
- Use `const` declarations for variables that are only assigned once.
- Put default function parameters and optional function parameters last.
- Include a `default` clause in switch statements.
- Use `for-of` loops when you need the index to extract an item from the iterated array.
- Use `node:assert/strict` over `node:assert`.
- Use the `node:` protocol for Node.js builtin modules.
- Use template literals over string concatenation.
- Use `new` when throwing an error.
- Don't throw non-Error values.
- Use `String.trimStart()` and `String.trimEnd()` over `String.trimLeft()` and `String.trimRight()`.
- Use standard constants instead of approximated literals.
- Don't assign values in expressions.
- Use `===` and `!==`.
- Don't use duplicate case labels.
- Don't use duplicate conditions in if-else-if chains.
- Don't use two keys with the same name inside objects.
- Don't use duplicate function parameter names.
- Don't let switch clauses fall through.
- Don't use labels that share a name with a variable.
- Don't redeclare variables, functions, classes, and types in the same scope.
- Don't let identifiers shadow restricted names.
- Don't use unsafe negation.
- Don't use var.
- Make sure async functions actually use await.
- Make sure default clauses in switch statements come last.

#### Next.js Specific Rules
- Don't use `<img>` elements in Next.js projects.
- Don't use `<head>` elements in Next.js projects.

#### Testing Best Practices
- Don't use export or module.exports in test files.
- Don't use focused tests.
- Make sure the assertion function, like expect, is placed inside an it() function call.
- Don't use disabled tests.