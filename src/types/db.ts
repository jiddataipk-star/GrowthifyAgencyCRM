import type { Database } from "./database";

type PublicSchema = Database["public"];

/** Row type of a table: Tables<"clients"> */
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export type Role = Enums<"member_role">;
export type Currency = Enums<"currency_code">;

export type { Database };
