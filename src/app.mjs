import express from "express";
import serverless from "serverless-http";
import routes from "./routes.mjs";

const app = express();
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: 200,
    code: "OK",
    data: { message: "Service is healthy" },
  });
});

// API info endpoint
app.get("/api/v1", (req, res) => {
  res.status(200).json({
    status: 200,
    code: "OK",
    data: {
      version: "1.0.0",
      endpoints: [
        "POST /api/v1/transactions/authorize",
        "POST /api/v1/transactions/debit",
        "POST /api/v1/transactions/credit",
        "POST /api/v1/transactions/reverse",
      ],
    },
  });
});

// Mount transaction routes under /api/v1/transactions
app.use("/api/v1/transactions", routes);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    code: "NOT_FOUND",
    error: `Route ${req.method} ${req.path} not found`,
  });
});

export const handler = serverless(app);

if (process.env.NODE_ENV !== "production") {
  app.listen(3000, () => console.log("Server running on :3000"));
}
