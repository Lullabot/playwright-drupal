import { describe, it, expect } from "vitest";
import {
  Ckeditor5 as GenericCkeditor5,
  selectAllModifier as genericSelectAllModifier,
} from "@lullabot/playwright-testing";
import { Ckeditor5, selectAllModifier } from "./ckeditor5";
import {
  Ckeditor5 as ExportedCkeditor5,
  selectAllModifier as exportedSelectAllModifier,
} from "./index";

describe("CKEditor 5 compatibility exports", () => {
  it("preserves the generic helpers through Drupal imports", () => {
    expect(Ckeditor5).toBe(GenericCkeditor5);
    expect(selectAllModifier).toBe(genericSelectAllModifier);
    expect(ExportedCkeditor5).toBe(GenericCkeditor5);
    expect(exportedSelectAllModifier).toBe(genericSelectAllModifier);
  });
});
