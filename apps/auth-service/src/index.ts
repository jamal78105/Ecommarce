import "dotenv/config";

import express from "express";
import { pinoHttp } from "pino-http";

import router from "./Router/auth.route.js";
import { logger } from "./config/logger.js";
import { env } from "./config/env.js";
import prisma from "./config/prisma.js";

import {
    connectRedis,
    disconnecting,
} from "./cache/redis-client.js";

import { errorHandler } from "./utils/errorHandler.js";

const app = express();

app.use(pinoHttp({ logger }));

app.use(express.json({
    limit: "16kb",
}));

app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "okay",
        service: "auth-service",
    });
});

app.use(router);

// Error Handler must be last.
app.use(errorHandler);

async function bootstrap() {
    //await connectRedis();

    const server = app.listen(env.PORT, () => {
        logger.info({
            port: env.PORT,
            event: "server.started",
        });
    });

    const shutdown = async () => {
        logger.info("Shutting down server...");

        server.close(async () => {
            await Promise.allSettled([
    //disconnecting(),
                prisma.$disconnect(),
            ]);

            process.exit(0);
        });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}

bootstrap().catch((error) => {
    logger.fatal(
        { err: error },
        "Failed to start application",
    );

    process.exit(1);
});

