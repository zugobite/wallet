import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import mariadb from "mariadb";

const pool = mariadb.createPool(process.env.DATABASE_ADAPTER_URL);
const adapter = new PrismaMariaDb(pool);

export const prisma = new PrismaClient({ adapter });
