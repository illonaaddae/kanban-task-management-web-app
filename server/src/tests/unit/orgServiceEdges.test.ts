import { Types } from "mongoose";
import type { InvitationDocument } from "../../models/Invitation";
import type { OrganizationDocument } from "../../models/Organization";
import type { UserDocument } from "../../models/User";
import { invitationRepository } from "../../repositories/invitationRepository";
import { organizationRepository } from "../../repositories/organizationRepository";
import { userRepository } from "../../repositories/userRepository";
import { emailService } from "../../services/emailService";
import { invitationService } from "../../services/invitationService";
import { organizationService } from "../../services/organizationService";
import { AppError } from "../../utils/AppError";

// Branches only reachable through a race - the row was there when `orgAccess`
// loaded it and gone by the time the service read it again - plus the
// unpopulated-ref paths, which the HTTP surface never produces because every
// read populates. Neither is testable from the integration suites.
jest.mock("../../repositories/organizationRepository");
jest.mock("../../repositories/invitationRepository");
jest.mock("../../repositories/userRepository");

const mockedOrgs = jest.mocked(organizationRepository);
const mockedInvitations = jest.mocked(invitationRepository);
const mockedUsers = jest.mocked(userRepository);

const ORG_ID = new Types.ObjectId();
const OWNER = new Types.ObjectId();
const MEMBER = new Types.ObjectId();

function fakeUser(id: Types.ObjectId, email = "someone@example.com"): UserDocument {
  return { _id: id, email, name: "Someone" } as unknown as UserDocument;
}

function fakeOrg(members: unknown[] = []): OrganizationDocument {
  return {
    _id: ORG_ID,
    name: "Acme",
    owner: OWNER,
    members,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  } as unknown as OrganizationDocument;
}

function fakeInvitation(overrides: Record<string, unknown> = {}): InvitationDocument {
  return {
    _id: new Types.ObjectId(),
    organization: ORG_ID,
    email: "invitee@example.com",
    role: "member",
    invitedBy: new Types.ObjectId(),
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as unknown as InvitationDocument;
}

describe("organizationService - the organization vanished mid-request", () => {
  it("404s on getDetailed", async () => {
    mockedOrgs.findByIdPopulated.mockResolvedValue(null);

    await expect(
      organizationService.getDetailed(ORG_ID.toString(), "owner"),
    ).rejects.toThrow(AppError);
  });

  it("404s on rename", async () => {
    mockedOrgs.updateById.mockResolvedValue(null);

    await expect(
      organizationService.rename(ORG_ID.toString(), "New name"),
    ).rejects.toThrow(AppError);
  });

  it("404s on remove without deleting anything", async () => {
    mockedOrgs.findById.mockResolvedValue(null);

    await expect(organizationService.remove(ORG_ID.toString())).rejects.toThrow(
      AppError,
    );
    // The cascade must not run against an organization that is already gone.
    expect(mockedInvitations.deleteForOrg).not.toHaveBeenCalled();
  });

  it("404s removing a member who is no longer one", async () => {
    mockedOrgs.removeMember.mockResolvedValue(null);

    await expect(
      organizationService.removeMember(fakeOrg(), MEMBER.toString()),
    ).rejects.toThrow(AppError);
  });
});

describe("organizationService.getDetailed with unpopulated refs", () => {
  it("drops entries it cannot render rather than showing half a person", async () => {
    // A bare ObjectId (not populated) and a deleted user both arrive without a
    // `name`. A row reading "undefined" is worse than no row.
    mockedOrgs.findByIdPopulated.mockResolvedValue(
      fakeOrg([{ user: MEMBER, role: "member", joinedAt: null }]),
    );

    const view = await organizationService.getDetailed(ORG_ID.toString(), "owner");

    expect(view.members).toEqual([]);
    // memberCount comes from the stored array, so it still reports the truth
    // about how many people are in the organization.
    expect(view.memberCount).toBe(2);
  });

  it("includes an avatar only when there is one", async () => {
    mockedOrgs.findByIdPopulated.mockResolvedValue(
      fakeOrg([
        {
          user: { _id: MEMBER, name: "With Avatar", email: "a@b.c", avatar: "http://x/y.png" },
          role: "admin",
          joinedAt: new Date("2026-02-01T00:00:00.000Z"),
        },
        {
          user: { _id: new Types.ObjectId(), name: "No Avatar", email: "d@e.f" },
          role: "member",
          joinedAt: null,
        },
      ]),
    );

    const view = await organizationService.getDetailed(ORG_ID.toString(), "orgAdmin");

    expect(view.members[0]).toMatchObject({
      name: "With Avatar",
      avatar: "http://x/y.png",
      joinedAt: "2026-02-01T00:00:00.000Z",
    });
    expect(view.members[1]).not.toHaveProperty("avatar");
    expect(view.members[1]?.joinedAt).toBeNull();
  });
});

describe("organizationService.listForUser", () => {
  it("reports a platform admin passing through as `admin`", async () => {
    // No ownership and no membership, so there is no real relationship to
    // report - only `protect`'s global role got them here.
    mockedOrgs.findForUser.mockResolvedValue([fakeOrg()]);

    const list = await organizationService.listForUser(fakeUser(new Types.ObjectId()));

    expect(list[0]?.myRole).toBe("admin");
  });

  it("distinguishes an org admin from a plain member", async () => {
    mockedOrgs.findForUser.mockResolvedValue([
      fakeOrg([{ user: MEMBER, role: "admin" }]),
    ]);

    const list = await organizationService.listForUser(fakeUser(MEMBER));

    expect(list[0]?.myRole).toBe("orgAdmin");
  });
});

describe("invitationService.invite", () => {
  it("rethrows a write failure that is not a duplicate key", async () => {
    mockedUsers.findByEmail.mockResolvedValue(null);
    mockedInvitations.create.mockRejectedValue(new Error("connection reset"));

    await expect(
      invitationService.invite(
        fakeOrg(),
        fakeUser(OWNER, "owner@example.com"),
        "invitee@example.com",
        "member",
      ),
    ).rejects.toThrow("connection reset");
  });

  it("409s when the invited address already owns the organization", async () => {
    // The owner is the `owner` field, not a members entry, so the membership
    // check has to consider both.
    mockedUsers.findByEmail.mockResolvedValue(fakeUser(OWNER, "owner@example.com"));

    await expect(
      invitationService.invite(
        fakeOrg(),
        fakeUser(new Types.ObjectId(), "admin@example.com"),
        "owner@example.com",
        "member",
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("invitationService.accept", () => {
  it("404s when the organization was deleted between invite and accept", async () => {
    mockedInvitations.findByTokenHash.mockResolvedValue(fakeInvitation());
    mockedOrgs.findById.mockResolvedValue(null);

    await expect(
      invitationService.accept("a-token", fakeUser(MEMBER, "invitee@example.com")),
    ).rejects.toThrow(AppError);
  });

  it("consumes the invitation without re-adding an existing member", async () => {
    mockedInvitations.findByTokenHash.mockResolvedValue(fakeInvitation());
    mockedOrgs.findById.mockResolvedValue(
      fakeOrg([{ user: MEMBER, role: "member" }]),
    );

    const result = await invitationService.accept(
      "a-token",
      fakeUser(MEMBER, "invitee@example.com"),
    );

    expect(result).toMatchObject({ organizationId: ORG_ID.toString(), role: "member" });
    expect(mockedOrgs.addMember).not.toHaveBeenCalled();
    // Still consumed, so the link cannot be reused.
    expect(mockedInvitations.markAccepted).toHaveBeenCalled();
  });

  it("resolves the organization id from a populated ref", async () => {
    // `findByTokenHash` populates `organization`, so the id is nested rather
    // than being the value itself.
    mockedInvitations.findByTokenHash.mockResolvedValue(
      fakeInvitation({ organization: { _id: ORG_ID, name: "Acme" } }),
    );
    mockedOrgs.findById.mockResolvedValue(fakeOrg());

    const result = await invitationService.accept(
      "a-token",
      fakeUser(MEMBER, "invitee@example.com"),
    );

    expect(mockedOrgs.findById).toHaveBeenCalledWith(ORG_ID.toString());
    expect(result.organizationName).toBe("Acme");
  });
});

describe("invitationService.listPending / listForUser with unpopulated refs", () => {
  it("reports a missing inviter as null instead of a broken row", async () => {
    mockedInvitations.findPendingForOrg.mockResolvedValue([
      // Unpopulated, or the inviting account was deleted.
      fakeInvitation({ invitedBy: new Types.ObjectId() }),
    ]);

    const [view] = await invitationService.listPending(ORG_ID.toString());

    expect(view?.invitedBy).toBeNull();
    expect(view?.isRedeemable).toBe(true);
  });

  it("falls back when the organization ref is not populated", async () => {
    mockedInvitations.findPendingForEmail.mockResolvedValue([
      fakeInvitation({ organization: ORG_ID }),
    ]);

    const [view] = await invitationService.listForUser(
      fakeUser(MEMBER, "invitee@example.com"),
    );

    expect(view?.organizationName).toBe("an organization");
  });

  it("hides an invitation that lapsed before the TTL sweep removed it", async () => {
    mockedInvitations.findPendingForEmail.mockResolvedValue([
      fakeInvitation({ expiresAt: new Date(Date.now() - 1000) }),
    ]);

    const list = await invitationService.listForUser(
      fakeUser(MEMBER, "invitee@example.com"),
    );

    expect(list).toEqual([]);
  });
});

describe("invitationService.revoke", () => {
  it("404s an invitation belonging to a different organization", async () => {
    mockedInvitations.findById.mockResolvedValue(
      fakeInvitation({ organization: new Types.ObjectId() }),
    );

    await expect(
      invitationService.revoke(ORG_ID.toString(), new Types.ObjectId().toString()),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockedInvitations.markRevoked).not.toHaveBeenCalled();
  });
});

describe("invitationService.acceptById", () => {
  it("joins when the address matches the session", async () => {
    const invitation = fakeInvitation();
    mockedInvitations.findById.mockResolvedValue(invitation);
    mockedOrgs.findById.mockResolvedValue(fakeOrg());

    const result = await invitationService.acceptById(
      invitation._id.toString(),
      fakeUser(MEMBER, "invitee@example.com"),
    );

    expect(mockedOrgs.addMember).toHaveBeenCalledWith(
      ORG_ID.toString(),
      MEMBER,
      "member",
    );
    expect(result.organizationName).toBe("Acme");
  });

  it("matches the address case-insensitively", async () => {
    mockedInvitations.findById.mockResolvedValue(fakeInvitation());
    mockedOrgs.findById.mockResolvedValue(fakeOrg());

    // Stored lower-cased on the invitation; the account may be mixed case.
    await expect(
      invitationService.acceptById(
        new Types.ObjectId().toString(),
        fakeUser(MEMBER, "Invitee@Example.com"),
      ),
    ).resolves.toMatchObject({ role: "member" });
  });

  it("404s an invitation that does not exist", async () => {
    mockedInvitations.findById.mockResolvedValue(null);

    await expect(
      invitationService.acceptById(
        new Types.ObjectId().toString(),
        fakeUser(MEMBER, "invitee@example.com"),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s an invitation for a different address, and joins nobody", async () => {
    mockedInvitations.findById.mockResolvedValue(fakeInvitation());

    await expect(
      invitationService.acceptById(
        new Types.ObjectId().toString(),
        fakeUser(MEMBER, "someone.else@example.com"),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockedOrgs.addMember).not.toHaveBeenCalled();
  });

  it("404s an already-accepted invitation", async () => {
    mockedInvitations.findById.mockResolvedValue(
      fakeInvitation({ status: "accepted" }),
    );

    await expect(
      invitationService.acceptById(
        new Types.ObjectId().toString(),
        fakeUser(MEMBER, "invitee@example.com"),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("invitationService.invite - email delivery is reported, not thrown", () => {
  it("returns emailSent false with the reason", async () => {
    mockedUsers.findByEmail.mockResolvedValue(null);
    mockedInvitations.create.mockResolvedValue(fakeInvitation());
    jest
      .spyOn(emailService, "sendOrganizationInvitation")
      .mockResolvedValue({ delivered: false, reason: "domain not verified" });

    const created = await invitationService.invite(
      fakeOrg(),
      fakeUser(OWNER, "owner@example.com"),
      "invitee@example.com",
      "admin",
    );

    // The invitation is valid regardless - failing here would leave the admin
    // unsure whether to retry, and the retry would 409.
    expect(created.emailSent).toBe(false);
    expect(created.emailError).toBe("domain not verified");
    expect(created.acceptUrl).toContain("/invite/");
  });
});
