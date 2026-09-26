import { describe, expect, it } from "vitest";
import { errorContrasena } from "./contrasena";

describe("errorContrasena", () => {
  it("pide largo mínimo", () => expect(errorContrasena("Abc123")).toMatch(/12/));
  it("pide mezcla", () => expect(errorContrasena("abcdefghijkl1")).toMatch(/Mezcla/));
  it("acepta una buena", () => expect(errorContrasena("Claqueta2026ok")).toBeNull());
});
