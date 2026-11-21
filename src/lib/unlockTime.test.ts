import { describe, expect, it } from "vitest";
import { countdown, serverResetTime, serverZoneLabel, unlockStatus } from "./unlockTime";

const reset = new Date("2026-11-21T13:00:00Z"); // 5:00 AM in Los Angeles
const LA = "America/Los_Angeles";

describe("unlock times", () => {
  it("shows reset as 8:00 AM server time (UTC−5)", () => {
    expect(serverResetTime()).toMatch(/^8:00\sAM server time$/);
    expect(serverZoneLabel()).toBe("UTC−5");
  });

  it("formats countdowns", () => {
    expect(countdown(2 * 3_600_000 + 14 * 60_000)).toBe("2h 14m");
    expect(countdown(3 * 3_600_000)).toBe("3h");
    expect(countdown(45 * 60_000)).toBe("45m");
    expect(countdown(10_000)).toBe("under a minute");
  });

  it("is not live before reset on its own day", () => {
    const s = unlockStatus(reset, new Date("2026-11-21T10:46:00Z"), null, LA); // 2:46 AM LA
    expect(s.state).toBe("soon");
    expect(s.label).toBe("Unlocks in 2h 14m");
    expect(s.at).toMatch(/^5:00\sAM PST · 8:00\sAM server time$/);
  });

  it("is live from reset until the next one, or until its end", () => {
    expect(unlockStatus(reset, new Date("2026-11-21T13:00:00Z"), null, LA).state).toBe("live");
    expect(unlockStatus(reset, new Date("2026-11-22T12:59:00Z"), null, LA).state).toBe("live");
    expect(unlockStatus(reset, new Date("2026-11-22T13:00:00Z"), null, LA).state).toBe("past");
    expect(unlockStatus(reset, new Date("2026-11-24T10:00:00Z"), new Date("2026-11-25T13:00:00Z"), LA).state).toBe("live");
  });

  it("counts later days in the player's time zone", () => {
    const now = new Date("2026-11-20T10:00:00Z"); // 2 AM Nov 20 in LA
    expect(unlockStatus(new Date("2026-11-22T13:00:00Z"), now, null, LA).label).toBe("In 2 days");
    expect(unlockStatus(new Date("2026-11-21T13:00:00Z"), new Date("2026-11-20T12:00:00Z"), null, LA).label).toBe("Tomorrow");
  });
});
