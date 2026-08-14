import { prisma } from "@/lib/prisma";
import LoginForm from "./LoginForm";

// Always read the current people list at request time.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Only people who have a password set can log in, so only show those.
  const users = await prisma.user.findMany({
    where: { passwordHash: { not: null } },
    select: { id: true, name: true, color: true },
    orderBy: { createdAt: "asc" },
  });

  return <LoginForm users={users} />;
}
