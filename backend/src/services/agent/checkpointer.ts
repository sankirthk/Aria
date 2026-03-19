import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { getLogger } from "../../config/logger";

const logger = getLogger("AgentCheckpointer");

export const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);

const originalSetup = checkpointer.setup.bind(checkpointer);
checkpointer.setup = async (...args: Parameters<typeof originalSetup>) => {
  logger.info("Checkpoint setup started");
  try {
    const result = await originalSetup(...args);
    logger.info("Checkpoint setup completed");
    return result;
  } catch (err: any) {
    logger.error("Checkpoint setup failed", { error: err.message, stack: err.stack });
    throw err;
  }
};
