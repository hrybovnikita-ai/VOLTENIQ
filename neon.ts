import { defineConfig } from "@neon/config/v1";

// Postgres is always provisioned for the linked Neon project.
// Auth / Functions / buckets stay off unless explicitly enabled later.
export default defineConfig({
  auth: false,
  branch: (branch) => {
    if (branch.isDefault) {
      return {};
    }
    if (!branch.exists) {
      return { ttl: "7d" };
    }
    return {};
  },
});
