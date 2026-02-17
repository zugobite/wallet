import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Wallet API",
      version: "1.3.3",
      description: "A secure, production-ready wallet transaction API with two-phase debit authorization",
      contact: {
        name: "Zugobite",
        url: "https://github.com/zugobite/wallet",
      },
    },
    servers: [
      {
        url: "/api/v1",
        description: "API Version 1",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Transaction: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            walletId: { type: "string", format: "uuid" },
            type: { type: "string", enum: ["authorize", "debit", "credit"] },
            amount: { type: "integer", description: "Amount in minor units (e.g. cents)" },
            status: { type: "string", enum: ["pending", "completed", "failed", "reversed"] },
            referenceId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            status: { type: "integer" },
            code: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    "./src/routes.mjs",
    "./src/routes/*.mjs",
  ],
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
};
