import { describe, expect, it } from "vitest";
import {
  AttachmentUploader,
  createPathResolver,
  generateA11yAnnotations,
  generateA11ySummary,
  generateFailureComment,
  generateFailureSummary,
  parseA11yResults,
  parseFailures,
} from "./index";

describe("GitHub package entry point", () => {
  it("exports the reporting, attachment, and path-remapping APIs", () => {
    expect(parseA11yResults).toBeTypeOf("function");
    expect(generateA11ySummary).toBeTypeOf("function");
    expect(generateA11yAnnotations).toBeTypeOf("function");
    expect(parseFailures).toBeTypeOf("function");
    expect(generateFailureSummary).toBeTypeOf("function");
    expect(generateFailureComment).toBeTypeOf("function");
    expect(AttachmentUploader).toBeTypeOf("function");
    expect(createPathResolver).toBeTypeOf("function");
  });
});
