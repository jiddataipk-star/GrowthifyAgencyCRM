import { Bot, Code2, Globe, Megaphone, MessageSquare, Shapes } from "lucide-react";
import type { Tone } from "@/components/ui/card";
import type { Enums } from "@/types/db";

/** Icon + tone per service line, used in project and subscription lists. */
export const SERVICE_ICON: Record<Enums<"service_type">, { icon: React.ReactNode; tone: Tone }> = {
  custom_software: { icon: <Code2 />, tone: "accent" },
  ai_automation: { icon: <Bot />, tone: "info" },
  web_app: { icon: <Globe />, tone: "success" },
  whatsapp_api: { icon: <MessageSquare />, tone: "success" },
  ads_management: { icon: <Megaphone />, tone: "warning" },
  other: { icon: <Shapes />, tone: "neutral" },
};
