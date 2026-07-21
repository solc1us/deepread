import type { Context } from "../../context";

type Session = NonNullable<Context["session"]>;

export function createGuestContext(): Context {
  return {
    auth: null,
    session: null,
    requestId: "integration-guest-request",
  };
}

export function createUserContext(user: {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
}): Context {
  const now = new Date();

  return {
    auth: null,
    requestId: `integration-${user.id}`,
    session: {
      session: {
        id: `session-${user.id}`,
        token: `test-token-${user.id}`,
        userId: user.id,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
        ipAddress: "127.0.0.1",
        userAgent: "deepread-integration-test",
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: true,
        image: null,
        role: user.role,
        createdAt: now,
        updatedAt: now,
      },
    } as Session,
  };
}
