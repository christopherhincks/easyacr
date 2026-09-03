import { describe, expect, it } from "vitest";
import { isMarketingHostname } from "./App";

describe("marketing host routing", () => {
  it("reserves the marketing domains for the public site", () => {
    expect(isMarketingHostname("www.easyacr.com")).toBe(true);
    expect(isMarketingHostname("easyacr.com")).toBe(true);
  });

  it("keeps the application host on the product experience", () => {
    expect(isMarketingHostname("app.easyacr.com")).toBe(false);
    expect(isMarketingHostname("localhost")).toBe(false);
  });
});
