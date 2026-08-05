import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import {
  generateTokens,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type TokenPayload,
} from "../../utils/generateTokens";

const payload: TokenPayload = {
  id: "507f1f77bcf86cd799439011",
  role: "editor",
  tokenVersion: 0,
};

/** Seconds between a token's iat and exp, i.e. its configured lifetime. */
function lifetimeOf(token: string): number {
  const decoded = jwt.decode(token) as { iat: number; exp: number };
  return decoded.exp - decoded.iat;
}

describe("generateTokens", () => {
  it("issues both tokens", () => {
    const { accessToken, refreshToken } = generateTokens(payload);

    expect(typeof accessToken).toBe("string");
    expect(typeof refreshToken).toBe("string");
    expect(accessToken).not.toBe(refreshToken);
  });

  it("puts only id, role and tokenVersion in the payload", () => {
    const decoded = jwt.decode(signAccessToken(payload)) as Record<string, unknown>;

    // iat/exp are added by jsonwebtoken itself.
    expect(Object.keys(decoded).sort()).toEqual([
      "exp",
      "iat",
      "id",
      "role",
      "tokenVersion",
    ]);
  });

  it("carries no email, name or password", () => {
    const raw = signAccessToken(payload);
    const decoded = jwt.decode(raw) as Record<string, unknown>;

    expect(decoded).not.toHaveProperty("email");
    expect(decoded).not.toHaveProperty("name");
    expect(decoded).not.toHaveProperty("password");
  });

  it("gives the access token a 1h lifetime and the refresh token 7d", () => {
    const { accessToken, refreshToken } = generateTokens(payload);

    expect(lifetimeOf(accessToken)).toBe(60 * 60);
    expect(lifetimeOf(refreshToken)).toBe(7 * 24 * 60 * 60);
  });

  it("signs the two tokens with different secrets", () => {
    const { accessToken, refreshToken } = generateTokens(payload);

    // The whole point of separate secrets: neither token verifies against the
    // other's key, so an access token cannot be replayed as a refresh token.
    expect(() => jwt.verify(accessToken, env.JWT_REFRESH_SECRET)).toThrow(
      jwt.JsonWebTokenError,
    );
    expect(() => jwt.verify(refreshToken, env.JWT_SECRET)).toThrow(
      jwt.JsonWebTokenError,
    );
  });
});

describe("verifyAccessToken", () => {
  it("round-trips a token it signed", () => {
    expect(verifyAccessToken(signAccessToken(payload))).toEqual(payload);
  });

  it("returns only the three known fields, dropping iat/exp", () => {
    const verified = verifyAccessToken(signAccessToken(payload));

    expect(Object.keys(verified).sort()).toEqual(["id", "role", "tokenVersion"]);
  });

  it("throws JsonWebTokenError on a garbled token", () => {
    expect(() => verifyAccessToken("not.a.jwt")).toThrow(jwt.JsonWebTokenError);
  });

  it("throws JsonWebTokenError on a token signed with the wrong secret", () => {
    const foreign = jwt.sign(payload, "a-different-secret-of-sufficient-length");

    expect(() => verifyAccessToken(foreign)).toThrow(jwt.JsonWebTokenError);
  });

  it("throws JsonWebTokenError when the signature has been tampered with", () => {
    const [header, body] = signAccessToken(payload).split(".");
    const forged = `${header}.${body}.deadbeef`;

    expect(() => verifyAccessToken(forged)).toThrow(jwt.JsonWebTokenError);
  });

  it("throws TokenExpiredError on an expired token", () => {
    const expired = jwt.sign(payload, env.JWT_SECRET, { expiresIn: "-1s" });

    expect(() => verifyAccessToken(expired)).toThrow(jwt.TokenExpiredError);
  });

  it("throws NotBeforeError on a token that is not active yet", () => {
    const future = jwt.sign(payload, env.JWT_SECRET, { notBefore: "1h" });

    expect(() => verifyAccessToken(future)).toThrow(jwt.NotBeforeError);
  });

  describe("payload shape", () => {
    // A correctly signed token can still carry the wrong shape — an old token
    // format, or a payload that was a bare string. Anything downstream that
    // trusts payload.id must not see these.
    it("rejects a validly signed token with no id", () => {
      const shapeless = jwt.sign({ role: "editor", tokenVersion: 0 }, env.JWT_SECRET);

      expect(() => verifyAccessToken(shapeless)).toThrow("Malformed token payload");
    });

    it("rejects a numeric id", () => {
      const bad = jwt.sign({ id: 7, role: "editor", tokenVersion: 0 }, env.JWT_SECRET);

      expect(() => verifyAccessToken(bad)).toThrow("Malformed token payload");
    });

    it("rejects a string tokenVersion", () => {
      const bad = jwt.sign(
        { id: payload.id, role: "editor", tokenVersion: "0" },
        env.JWT_SECRET,
      );

      expect(() => verifyAccessToken(bad)).toThrow("Malformed token payload");
    });

    it("rejects a bare-string payload", () => {
      const bare = jwt.sign("just-a-string", env.JWT_SECRET);

      expect(() => verifyAccessToken(bare)).toThrow(jwt.JsonWebTokenError);
    });
  });
});

describe("verifyRefreshToken", () => {
  it("round-trips a refresh token", () => {
    expect(verifyRefreshToken(signRefreshToken(payload))).toEqual(payload);
  });

  it("refuses an access token", () => {
    expect(() => verifyRefreshToken(signAccessToken(payload))).toThrow(
      jwt.JsonWebTokenError,
    );
  });

  it("applies the same payload-shape check", () => {
    const shapeless = jwt.sign({ id: payload.id }, env.JWT_REFRESH_SECRET);

    expect(() => verifyRefreshToken(shapeless)).toThrow("Malformed token payload");
  });
});
