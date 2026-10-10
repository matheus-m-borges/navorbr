
import { describe, it, expect } from "vitest";

describe("ENV DEBUG", () => {
  it("should have supabase vars", () => {
    console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "SET (" + process.env.SUPABASE_URL.substring(0, 20) + "...)" : "UNSET");
    console.log("VITE_SUPABASE_URL:", process.env.VITE_SUPABASE_URL ? "SET" : "UNSET");
    console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET (len=" + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ")" : "UNSET");
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
    expect(process.env.SUPABASE_URL).toBeDefined();
  });
});

