import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';

//* Prisma 7 requires an explicit driver adapter to connect to Postgres
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

//* Single shared instance — imported by every file that needs the DB,
//* instead of creating a new connection each time
export default prisma;