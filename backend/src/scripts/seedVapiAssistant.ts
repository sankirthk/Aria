import prisma from "../clients/prismaClient";
import { getLogger } from "../config/logger";

const logger = getLogger("SeedVapiAssistant");

export async function seedVapiAssistant() {
  const vapiAssistantId = process.env.VAPI_ASSISTANT_ID;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

  if (!vapiAssistantId || !phoneNumberId) {
    logger.warn("VAPI_ASSISTANT_ID or VAPI_PHONE_NUMBER_ID not set — skipping VapiAssistant seed");
    return;
  }

  const existing = await prisma.vapiAssistant.findUnique({ where: { vapiAssistantId } });
  if (existing) {
    logger.info("VapiAssistant already seeded — skipping");
    return;
  }

  await prisma.vapiAssistant.create({
    data: {
      vapiAssistantId,
      phoneNumberId,
      name: "Aria",
      active: true,
    },
  });

  logger.info("VapiAssistant seeded", { vapiAssistantId, phoneNumberId });
}
