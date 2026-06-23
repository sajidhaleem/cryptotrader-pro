// Global test setup — runs before every test file
import { vi } from "vitest";

// Silence console.warn in tests unless overridden
vi.spyOn(console, "warn").mockImplementation(() => {});
