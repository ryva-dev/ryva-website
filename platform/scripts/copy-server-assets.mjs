import { cp, mkdir } from "node:fs/promises";

const source = new URL("../packages/database/src/migrations", import.meta.url);
const destination = new URL("../dist/packages/database/src/migrations", import.meta.url);
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
