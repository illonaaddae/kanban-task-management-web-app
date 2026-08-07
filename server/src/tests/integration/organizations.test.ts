import { Types } from "mongoose";
import request from "supertest";
import app from "../../app";
import { Invitation } from "../../models/Invitation";
import { Organization } from "../../models/Organization";
import { User } from "../../models/User";
import { emailService } from "../../services/emailService";
import { registerAndLogin, type AuthedUser } from "../fixtures/auth";

beforeAll(async () => {
  await User.init();
  // The partial unique index on pending invitations is what enforces
  // one-invite-per-address; without init() the duplicate case would pass by
  // accident.
  await Invitation.init();
});

// No RESEND_API_KEY in tests, so the real emailService reports `delivered:
// false` and logs instead of sending. Stubbed anyway, so the suite asserts on
// what was requested rather than on the absence of configuration.
let sendInvitation: jest.SpiedFunction<
  typeof emailService.sendOrganizationInvitation
>;

beforeEach(() => {
  sendInvitation = jest
    .spyOn(emailService, "sendOrganizationInvitation")
    .mockResolvedValue({ delivered: true, id: "email_test" });
});

const MISSING_ID = new Types.ObjectId().toString();

async function createOrg(actor: AuthedUser, name = "Acme") {
  const res = await request(app)
    .post("/orgs")
    .set(actor.authHeader)
    .send({ name })
    .expect(201);

  return res.body.data.organization as { id: string; name: string };
}

/** Invites an address and hands back the one-time accept token from the link. */
async function inviteAddress(
  actor: AuthedUser,
  orgId: string,
  email: string,
  role: "admin" | "member" = "member",
) {
  const res = await request(app)
    .post(`/orgs/${orgId}/invitations`)
    .set(actor.authHeader)
    .send({ email, role })
    .expect(201);

  const { acceptUrl, invitation } = res.body.data;
  return { token: acceptUrl.split("/invite/")[1] as string, invitation, body: res.body.data };
}

/** Invites a registered user and has them accept, i.e. a real join. */
async function addMember(
  owner: AuthedUser,
  orgId: string,
  member: AuthedUser,
  role: "admin" | "member" = "member",
) {
  const { token } = await inviteAddress(owner, orgId, member.user.email, role);
  await request(app)
    .post(`/invitations/${token}/accept`)
    .set(member.authHeader)
    .expect(200);
}

describe("POST /orgs", () => {
  it("creates an organization owned by the caller", async () => {
    const owner = await registerAndLogin(app);

    const res = await request(app)
      .post("/orgs")
      .set(owner.authHeader)
      .send({ name: "Acme" })
      .expect(201);

    expect(res.body.data.organization).toMatchObject({
      name: "Acme",
      myRole: "owner",
      // The owner is not a members entry, so a fresh organization reports 1.
      memberCount: 1,
    });

    const stored = await Organization.findById(res.body.data.organization.id);
    expect(stored?.owner.toString()).toBe(owner.user.id);
  });

  it("rejects a blank name with details", async () => {
    const owner = await registerAndLogin(app);

    const res = await request(app)
      .post("/orgs")
      .set(owner.authHeader)
      .send({ name: "   " })
      .expect(400);

    expect(res.body.status).toBe("error");
    expect(res.body.details).toEqual([
      expect.objectContaining({ field: "name" }),
    ]);
  });

  it("requires a token", async () => {
    await request(app).post("/orgs").send({ name: "Acme" }).expect(401);
  });
});

describe("GET /orgs", () => {
  it("returns organizations the caller owns and ones they joined", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const stranger = await registerAndLogin(app);

    const mine = await createOrg(owner, "Mine");
    const theirs = await createOrg(stranger, "Theirs");
    await addMember(owner, mine.id, member);

    const res = await request(app)
      .get("/orgs")
      .set(member.authHeader)
      .expect(200);

    expect(res.body.data.organizations).toHaveLength(1);
    expect(res.body.data.organizations[0]).toMatchObject({
      id: mine.id,
      myRole: "member",
      memberCount: 2,
    });

    // Someone else's organization is not visible at all.
    const ids = res.body.data.organizations.map((o: { id: string }) => o.id);
    expect(ids).not.toContain(theirs.id);
  });
});

describe("GET /orgs/:id", () => {
  it("lists the owner first, then members", async () => {
    const owner = await registerAndLogin(app, { name: "Owner Person" });
    const member = await registerAndLogin(app, { name: "Member Person" });
    const org = await createOrg(owner);
    await addMember(owner, org.id, member, "admin");

    const res = await request(app)
      .get(`/orgs/${org.id}`)
      .set(member.authHeader)
      .expect(200);

    expect(res.body.data.organization.myRole).toBe("orgAdmin");
    expect(res.body.data.organization.members).toHaveLength(2);
    expect(res.body.data.organization.members[0]).toMatchObject({
      id: owner.user.id,
      role: "owner",
    });
    expect(res.body.data.organization.members[1]).toMatchObject({
      id: member.user.id,
      role: "admin",
    });
  });

  it("403s a non-member — an existing organization is never a 404 probe", async () => {
    const owner = await registerAndLogin(app);
    const stranger = await registerAndLogin(app);
    const org = await createOrg(owner);

    await request(app)
      .get(`/orgs/${org.id}`)
      .set(stranger.authHeader)
      .expect(403);
  });

  it("404s a missing organization before any permission check", async () => {
    const user = await registerAndLogin(app);

    await request(app)
      .get(`/orgs/${MISSING_ID}`)
      .set(user.authHeader)
      .expect(404);
  });

  it("400s a malformed id", async () => {
    const user = await registerAndLogin(app);

    await request(app).get("/orgs/not-an-id").set(user.authHeader).expect(400);
  });
});

describe("PATCH /orgs/:id", () => {
  it("lets the owner rename it", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);

    const res = await request(app)
      .patch(`/orgs/${org.id}`)
      .set(owner.authHeader)
      .send({ name: "Renamed" })
      .expect(200);

    expect(res.body.data.organization.name).toBe("Renamed");
  });

  it("403s an org admin — renaming is owner-only", async () => {
    const owner = await registerAndLogin(app);
    const admin = await registerAndLogin(app);
    const org = await createOrg(owner);
    await addMember(owner, org.id, admin, "admin");

    await request(app)
      .patch(`/orgs/${org.id}`)
      .set(admin.authHeader)
      .send({ name: "Renamed" })
      .expect(403);
  });
});

describe("DELETE /orgs/:id", () => {
  it("deletes the organization and its invitations", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);
    await inviteAddress(owner, org.id, "nobody@example.com");

    const res = await request(app)
      .delete(`/orgs/${org.id}`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.deleted).toEqual({ invitations: 1 });
    expect(await Organization.findById(org.id)).toBeNull();
    // Left behind, an invitation's token would resolve to a dangling ref.
    expect(await Invitation.countDocuments({ organization: org.id })).toBe(0);
  });

  it("403s a member", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const org = await createOrg(owner);
    await addMember(owner, org.id, member);

    await request(app)
      .delete(`/orgs/${org.id}`)
      .set(member.authHeader)
      .expect(403);
  });
});

describe("POST /orgs/:id/invitations", () => {
  it("invites an address that has no account yet", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);

    const res = await request(app)
      .post(`/orgs/${org.id}/invitations`)
      .set(owner.authHeader)
      .send({ email: "New.Person@Example.com", role: "admin" })
      .expect(201);

    expect(res.body.data.invitation).toMatchObject({
      // Lower-cased, because it is matched against User.email on accept.
      email: "new.person@example.com",
      role: "admin",
      isRedeemable: true,
    });
    expect(res.body.data.emailSent).toBe(true);
    expect(res.body.data.acceptUrl).toContain("/invite/");

    // The token itself is never persisted — only its hash.
    const stored = await Invitation.findById(res.body.data.invitation.id);
    const token = res.body.data.acceptUrl.split("/invite/")[1];
    expect(stored?.tokenHash).not.toBe(token);
    expect(stored?.tokenHash).toHaveLength(64);

    expect(sendInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new.person@example.com",
        organizationName: "Acme",
        role: "an admin",
      }),
    );
  });

  it("never returns the token hash to the client", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);

    const { invitation } = await inviteAddress(owner, org.id, "x@example.com");

    expect(invitation).not.toHaveProperty("tokenHash");
  });

  it("defaults the role to member, the least privilege", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);

    const res = await request(app)
      .post(`/orgs/${org.id}/invitations`)
      .set(owner.authHeader)
      .send({ email: "someone@example.com" })
      .expect(201);

    expect(res.body.data.invitation.role).toBe("member");
  });

  it("still creates the invitation when the email cannot be delivered", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);
    sendInvitation.mockResolvedValue({
      delivered: false,
      reason: "Email delivery is not configured",
    });

    const res = await request(app)
      .post(`/orgs/${org.id}/invitations`)
      .set(owner.authHeader)
      .send({ email: "someone@example.com" })
      .expect(201);

    // Reported, not thrown: the link works, so failing the request would leave
    // the admin unsure whether to retry — and a retry would 409.
    expect(res.body.data.emailSent).toBe(false);
    expect(res.body.data.emailError).toBe("Email delivery is not configured");
    expect(await Invitation.countDocuments({ organization: org.id })).toBe(1);
  });

  it("409s a second pending invitation for the same address", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);
    await inviteAddress(owner, org.id, "dup@example.com");

    const res = await request(app)
      .post(`/orgs/${org.id}/invitations`)
      .set(owner.authHeader)
      .send({ email: "dup@example.com" })
      .expect(409);

    expect(res.body.message).toMatch(/pending invitation/i);
  });

  it("allows a re-invite after the first was revoked", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);
    const { invitation } = await inviteAddress(owner, org.id, "again@example.com");

    await request(app)
      .delete(`/orgs/${org.id}/invitations/${invitation.id}`)
      .set(owner.authHeader)
      .expect(200);

    // The unique index is partial on `status: pending`, so the revoked row stays
    // as history without blocking this.
    await request(app)
      .post(`/orgs/${org.id}/invitations`)
      .set(owner.authHeader)
      .send({ email: "again@example.com" })
      .expect(201);
  });

  it("409s someone who is already a member", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const org = await createOrg(owner);
    await addMember(owner, org.id, member);

    await request(app)
      .post(`/orgs/${org.id}/invitations`)
      .set(owner.authHeader)
      .send({ email: member.user.email })
      .expect(409);
  });

  it("400s inviting yourself", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);

    await request(app)
      .post(`/orgs/${org.id}/invitations`)
      .set(owner.authHeader)
      .send({ email: owner.user.email })
      .expect(400);
  });

  it("400s a malformed email and an unknown role", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);

    await request(app)
      .post(`/orgs/${org.id}/invitations`)
      .set(owner.authHeader)
      .send({ email: "not-an-email" })
      .expect(400);

    await request(app)
      .post(`/orgs/${org.id}/invitations`)
      .set(owner.authHeader)
      .send({ email: "ok@example.com", role: "superuser" })
      .expect(400);
  });

  it("403s a plain member — inviting grants access to the team's work", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const org = await createOrg(owner);
    await addMember(owner, org.id, member);

    await request(app)
      .post(`/orgs/${org.id}/invitations`)
      .set(member.authHeader)
      .send({ email: "someone@example.com" })
      .expect(403);
  });

  it("lets an org admin invite", async () => {
    const owner = await registerAndLogin(app);
    const admin = await registerAndLogin(app);
    const org = await createOrg(owner);
    await addMember(owner, org.id, admin, "admin");

    await request(app)
      .post(`/orgs/${org.id}/invitations`)
      .set(admin.authHeader)
      .send({ email: "someone@example.com" })
      .expect(201);
  });
});

describe("GET /orgs/:id/invitations", () => {
  it("lists pending invitations for an admin", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);
    await inviteAddress(owner, org.id, "one@example.com");
    await inviteAddress(owner, org.id, "two@example.com");

    const res = await request(app)
      .get(`/orgs/${org.id}/invitations`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.count).toBe(2);
    expect(res.body.data.invitations[0]).not.toHaveProperty("tokenHash");
    expect(res.body.data.invitations[0].invitedBy).toMatchObject({
      id: owner.user.id,
    });
  });

  it("403s a plain member", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const org = await createOrg(owner);
    await addMember(owner, org.id, member);

    await request(app)
      .get(`/orgs/${org.id}/invitations`)
      .set(member.authHeader)
      .expect(403);
  });
});

describe("DELETE /orgs/:id/invitations/:invitationId", () => {
  it("revokes it and kills the link", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);
    const { token, invitation } = await inviteAddress(
      owner,
      org.id,
      "gone@example.com",
    );

    await request(app)
      .delete(`/orgs/${org.id}/invitations/${invitation.id}`)
      .set(owner.authHeader)
      .expect(200);

    await request(app).get(`/invitations/${token}`).expect(404);
  });

  it("404s an invitation belonging to another organization", async () => {
    const owner = await registerAndLogin(app);
    const other = await registerAndLogin(app);
    const mine = await createOrg(owner, "Mine");
    const theirs = await createOrg(other, "Theirs");
    const { invitation } = await inviteAddress(other, theirs.id, "x@example.com");

    // Authorised for `mine`, but the invitation is not in it.
    await request(app)
      .delete(`/orgs/${mine.id}/invitations/${invitation.id}`)
      .set(owner.authHeader)
      .expect(404);
  });

  it("409s revoking twice", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);
    const { invitation } = await inviteAddress(owner, org.id, "x@example.com");

    await request(app)
      .delete(`/orgs/${org.id}/invitations/${invitation.id}`)
      .set(owner.authHeader)
      .expect(200);

    await request(app)
      .delete(`/orgs/${org.id}/invitations/${invitation.id}`)
      .set(owner.authHeader)
      .expect(409);
  });
});

describe("GET /invitations/:token", () => {
  it("previews without a session, so the invitee knows which address to use", async () => {
    const owner = await registerAndLogin(app, { name: "Illona" });
    const org = await createOrg(owner, "Acme");
    const { token } = await inviteAddress(owner, org.id, "new@example.com");

    const res = await request(app).get(`/invitations/${token}`).expect(200);

    expect(res.body.data.invitation).toMatchObject({
      organizationName: "Acme",
      invitedBy: "Illona",
      email: "new@example.com",
      role: "member",
    });
  });

  it("404s an unknown token", async () => {
    await request(app)
      .get("/invitations/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
      .expect(404);
  });

  it("400s a token that is not even the right shape", async () => {
    await request(app).get("/invitations/short").expect(400);
  });
});

describe("POST /invitations/:token/accept", () => {
  it("adds the invited user as a member with the invited role", async () => {
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app);
    const org = await createOrg(owner);
    const { token } = await inviteAddress(
      owner,
      org.id,
      invitee.user.email,
      "admin",
    );

    const res = await request(app)
      .post(`/invitations/${token}/accept`)
      .set(invitee.authHeader)
      .expect(200);

    expect(res.body.data).toMatchObject({
      organizationId: org.id,
      organizationName: "Acme",
      role: "admin",
    });

    const stored = await Organization.findById(org.id);
    expect(stored?.members).toHaveLength(1);
    expect(stored?.members[0]?.role).toBe("admin");

    const invitation = await Invitation.findOne({ organization: org.id });
    expect(invitation?.status).toBe("accepted");
    expect(invitation?.acceptedBy?.toString()).toBe(invitee.user.id);
  });

  it("403s a signed-in user whose address is not the invited one", async () => {
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app);
    const wrongPerson = await registerAndLogin(app);
    const org = await createOrg(owner);
    const { token } = await inviteAddress(owner, org.id, invitee.user.email);

    // Without this the link is a bearer credential for anyone it is forwarded to.
    const res = await request(app)
      .post(`/invitations/${token}/accept`)
      .set(wrongPerson.authHeader)
      .expect(403);

    expect(res.body.message).toContain(invitee.user.email);

    const stored = await Organization.findById(org.id);
    expect(stored?.members).toHaveLength(0);
  });

  it("401s without a session", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);
    const { token } = await inviteAddress(owner, org.id, "new@example.com");

    await request(app).post(`/invitations/${token}/accept`).expect(401);
  });

  it("does not add the member twice when the link is replayed", async () => {
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app);
    const org = await createOrg(owner);
    const { token } = await inviteAddress(owner, org.id, invitee.user.email);

    await request(app)
      .post(`/invitations/${token}/accept`)
      .set(invitee.authHeader)
      .expect(200);

    // Single use: the row is no longer pending, so the token is dead.
    await request(app)
      .post(`/invitations/${token}/accept`)
      .set(invitee.authHeader)
      .expect(404);

    const stored = await Organization.findById(org.id);
    expect(stored?.members).toHaveLength(1);
  });

  it("404s an expired invitation before the TTL sweep removes it", async () => {
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app);
    const org = await createOrg(owner);
    const { token, invitation } = await inviteAddress(
      owner,
      org.id,
      invitee.user.email,
    );

    // Mongo's TTL monitor only runs about once a minute, so every read path has
    // to check the clock rather than trust the row's existence.
    await Invitation.findByIdAndUpdate(invitation.id, {
      expiresAt: new Date(Date.now() - 1000),
    });

    await request(app)
      .post(`/invitations/${token}/accept`)
      .set(invitee.authHeader)
      .expect(404);
  });
});

describe("GET /invitations/mine", () => {
  it("finds invitations waiting for the caller's address", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner, "Acme");
    const invitee = await registerAndLogin(app);
    await inviteAddress(owner, org.id, invitee.user.email);

    // The path someone takes when they registered *after* being invited and no
    // longer have the email.
    const res = await request(app)
      .get("/invitations/mine")
      .set(invitee.authHeader)
      .expect(200);

    expect(res.body.data.invitations).toHaveLength(1);
    expect(res.body.data.invitations[0]).toMatchObject({
      organizationName: "Acme",
      role: "member",
    });
  });

  it("is empty for someone with no invitations", async () => {
    const user = await registerAndLogin(app);

    const res = await request(app)
      .get("/invitations/mine")
      .set(user.authHeader)
      .expect(200);

    expect(res.body.data.invitations).toEqual([]);
  });
});

describe("POST /invitations/mine/:invitationId/accept", () => {
  it("joins without the token, for someone who no longer has the email", async () => {
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app);
    const org = await createOrg(owner);
    await inviteAddress(owner, org.id, invitee.user.email, "admin");

    const listed = await request(app)
      .get("/invitations/mine")
      .set(invitee.authHeader)
      .expect(200);

    const res = await request(app)
      .post(`/invitations/mine/${listed.body.data.invitations[0].id}/accept`)
      .set(invitee.authHeader)
      .expect(200);

    expect(res.body.data).toMatchObject({ organizationId: org.id, role: "admin" });

    const stored = await Organization.findById(org.id);
    expect(stored?.members).toHaveLength(1);
  });

  it("404s an invitation addressed to somebody else", async () => {
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app);
    const wrongPerson = await registerAndLogin(app);
    const org = await createOrg(owner);
    await inviteAddress(owner, org.id, invitee.user.email);

    const invitation = await Invitation.findOne({ organization: org.id });

    // 404 rather than 403: an invitation for somebody else is not this
    // caller's to know exists.
    await request(app)
      .post(`/invitations/mine/${invitation!._id.toString()}/accept`)
      .set(wrongPerson.authHeader)
      .expect(404);

    const stored = await Organization.findById(org.id);
    expect(stored?.members).toHaveLength(0);
  });

  it("404s an expired invitation", async () => {
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app);
    const org = await createOrg(owner);
    await inviteAddress(owner, org.id, invitee.user.email);

    const invitation = await Invitation.findOne({ organization: org.id });
    await Invitation.findByIdAndUpdate(invitation!._id, {
      expiresAt: new Date(Date.now() - 1000),
    });

    await request(app)
      .post(`/invitations/mine/${invitation!._id.toString()}/accept`)
      .set(invitee.authHeader)
      .expect(404);
  });

  it("401s without a session", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);
    await inviteAddress(owner, org.id, "someone@example.com");
    const invitation = await Invitation.findOne({ organization: org.id });

    await request(app)
      .post(`/invitations/mine/${invitation!._id.toString()}/accept`)
      .expect(401);
  });

  it("400s a malformed invitation id", async () => {
    const user = await registerAndLogin(app);

    await request(app)
      .post("/invitations/mine/not-an-id/accept")
      .set(user.authHeader)
      .expect(400);
  });
});

describe("PATCH /orgs/:id/members/:userId", () => {
  it("promotes a member to admin", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const org = await createOrg(owner);
    await addMember(owner, org.id, member);

    const res = await request(app)
      .patch(`/orgs/${org.id}/members/${member.user.id}`)
      .set(owner.authHeader)
      .send({ role: "admin" })
      .expect(200);

    const updated = res.body.data.organization.members.find(
      (m: { id: string }) => m.id === member.user.id,
    );
    expect(updated.role).toBe("admin");
  });

  it("400s changing the owner's role — the model does not express it", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);

    await request(app)
      .patch(`/orgs/${org.id}/members/${owner.user.id}`)
      .set(owner.authHeader)
      .send({ role: "member" })
      .expect(400);
  });

  it("404s someone who is not a member", async () => {
    const owner = await registerAndLogin(app);
    const stranger = await registerAndLogin(app);
    const org = await createOrg(owner);

    await request(app)
      .patch(`/orgs/${org.id}/members/${stranger.user.id}`)
      .set(owner.authHeader)
      .send({ role: "admin" })
      .expect(404);
  });

  it("403s a plain member", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const other = await registerAndLogin(app);
    const org = await createOrg(owner);
    await addMember(owner, org.id, member);
    await addMember(owner, org.id, other);

    await request(app)
      .patch(`/orgs/${org.id}/members/${other.user.id}`)
      .set(member.authHeader)
      .send({ role: "admin" })
      .expect(403);
  });
});

describe("DELETE /orgs/:id/members/:userId", () => {
  it("lets an admin remove a member", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const org = await createOrg(owner);
    await addMember(owner, org.id, member);

    await request(app)
      .delete(`/orgs/${org.id}/members/${member.user.id}`)
      .set(owner.authHeader)
      .expect(200);

    const stored = await Organization.findById(org.id);
    expect(stored?.members).toHaveLength(0);
  });

  it("lets a member leave on their own", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const org = await createOrg(owner);
    await addMember(owner, org.id, member);

    const res = await request(app)
      .delete(`/orgs/${org.id}/members/${member.user.id}`)
      .set(member.authHeader)
      .expect(200);

    expect(res.body.data.message).toMatch(/left the organization/i);
  });

  it("403s a member removing somebody else", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const other = await registerAndLogin(app);
    const org = await createOrg(owner);
    await addMember(owner, org.id, member);
    await addMember(owner, org.id, other);

    await request(app)
      .delete(`/orgs/${org.id}/members/${other.user.id}`)
      .set(member.authHeader)
      .expect(403);
  });

  it("400s removing the owner — delete the organization instead", async () => {
    const owner = await registerAndLogin(app);
    const org = await createOrg(owner);

    await request(app)
      .delete(`/orgs/${org.id}/members/${owner.user.id}`)
      .set(owner.authHeader)
      .expect(400);
  });
});
