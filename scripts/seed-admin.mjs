// Админ хэрэглэгч үүсгэнэ: ADMIN_PHONE, ADMIN_PASSWORD орчны хувьсагчаас
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const phone = process.env.ADMIN_PHONE;
const password = process.env.ADMIN_PASSWORD;
if (!phone || !password) {
  console.error("ADMIN_PHONE, ADMIN_PASSWORD тохируулна уу");
  process.exit(1);
}

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 10);
await prisma.user.upsert({
  where: { phone },
  update: { passwordHash, role: "ADMIN", status: "ACTIVE" },
  create: { phone, passwordHash, name: "Админ", role: "ADMIN", status: "ACTIVE" },
});
console.log(`Админ бэлэн: ${phone}`);
await prisma.$disconnect();
