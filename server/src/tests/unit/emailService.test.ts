import { env } from "../../config/env";

const send = jest.fn();

// Mocked at the module boundary so no test can reach the network, whatever the
// developer happens to have in their .env.
jest.mock("resend", () => ({
  Resend: jest.fn(() => ({ emails: { send } })),
}));

// Imported after the mock is registered.
import { emailService, resetEmailClient } from "../../services/emailService";

const ARGS = {
  to: "invitee@example.com",
  inviterName: "Illona",
  organizationName: "Acme",
  role: "a member",
  acceptUrl: "https://app.example.com/invite/tok123",
  expiresInDays: 7,
};

/** Pretends a key is configured, and drops the memoised client so it is used. */
function withEmailConfigured() {
  jest.replaceProperty(env, "emailEnabled", true);
  jest.replaceProperty(env, "RESEND_API_KEY", "re_test_key");
  resetEmailClient();
}

beforeEach(() => {
  send.mockReset();
  resetEmailClient();
});

afterEach(() => {
  resetEmailClient();
});

describe("emailService without a key", () => {
  it("reports undelivered instead of throwing", async () => {
    jest.replaceProperty(env, "emailEnabled", false);
    resetEmailClient();

    const result = await emailService.sendOrganizationInvitation(ARGS);

    // The invitation is still valid — the admin just has to pass on the link.
    expect(result).toEqual({
      delivered: false,
      reason: "Email delivery is not configured",
    });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("emailService with a key", () => {
  beforeEach(withEmailConfigured);

  it("sends from the configured address with both html and text", async () => {
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    const result = await emailService.sendOrganizationInvitation(ARGS);

    expect(result).toEqual({ delivered: true, id: "email_123" });

    const [payload] = send.mock.calls[0];
    expect(payload).toMatchObject({
      from: env.EMAIL_FROM,
      to: ["invitee@example.com"],
      subject: "Illona invited you to join Acme",
    });
    // A text part is not optional in practice: without one, spam filters score
    // the message worse and plain-text clients show nothing.
    expect(payload.text).toContain(ARGS.acceptUrl);
    expect(payload.html).toContain(ARGS.acceptUrl);
  });

  it("treats an error payload as a failure", async () => {
    // Resend reports refusals in the payload rather than throwing, so an
    // unchecked call reads as success for every rejected address.
    send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Invalid `to` field" },
    });

    const result = await emailService.sendOrganizationInvitation(ARGS);

    expect(result).toEqual({ delivered: false, reason: "Invalid `to` field" });
  });

  it("survives the client throwing", async () => {
    send.mockRejectedValue(new Error("socket hang up"));

    const result = await emailService.sendOrganizationInvitation(ARGS);

    expect(result).toEqual({ delivered: false, reason: "socket hang up" });
  });

  it("escapes interpolated names, so an org name cannot inject markup", async () => {
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await emailService.sendOrganizationInvitation({
      ...ARGS,
      organizationName: '<script>alert("x")</script>',
      inviterName: 'Bob "The Builder" & Co',
    });

    const [payload] = send.mock.calls[0];
    expect(payload.html).not.toContain("<script>");
    expect(payload.html).toContain("&lt;script&gt;");
    expect(payload.html).toContain("&amp;");
  });

  it("reuses one client across sends", async () => {
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });
    const { Resend } = jest.requireMock("resend") as { Resend: jest.Mock };
    Resend.mockClear();

    await emailService.sendOrganizationInvitation(ARGS);
    await emailService.sendOrganizationInvitation(ARGS);

    expect(Resend).toHaveBeenCalledTimes(1);
  });
});
