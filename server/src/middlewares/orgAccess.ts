import type { Request, RequestHandler } from "express";
import type { OrganizationDocument } from "../models/Organization";
import { organizationRepository } from "../repositories/organizationRepository";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

/**
 * What the caller may do in one specific organization.
 *
 * `admin` here is the *platform* role reaching an organization it has no
 * membership in — distinct from the org-level `admin` grant, which is
 * `orgAdmin`. Naming them apart avoids the one confusion this two-level model
 * invites.
 */
export type EffectiveOrgRole = "member" | "orgAdmin" | "owner" | "admin";

/** Minimum organization-level role a route can demand. */
export type MinOrgRole = "member" | "orgAdmin" | "owner";

const RANK: Record<EffectiveOrgRole, number> = {
  member: 1,
  orgAdmin: 2,
  owner: 3,
  admin: 4,
};

/**
 * Where the organization id comes from, most specific first:
 *   1. `req.params.orgId` — nested routes like /orgs/:orgId/members
 *   2. `req.params.id`    — /orgs/:id
 *
 * The body is deliberately not consulted: no organization route takes an org id
 * in its payload, so accepting one would only add a way to smuggle it past a
 * path-based check.
 */
function resolveOrgId(req: Request): string | undefined {
  const candidate = req.params.orgId ?? req.params.id;
  return typeof candidate === "string" ? candidate : undefined;
}

function relationshipTo(
  org: OrganizationDocument,
  userId: string,
): EffectiveOrgRole | null {
  if (org.owner.toString() === userId) return "owner";

  const entry = org.members.find((m) => m.user.toString() === userId);
  if (!entry) return null;
  return entry.role === "admin" ? "orgAdmin" : "member";
}

/**
 * Organization-level authorisation. Runs after `protect`.
 *
 * Same order as `boardAccess`: existence 404s *before* any permission
 * reasoning, so a missing organization never reports 403. An organization that
 * exists but does not include the caller returns 403, not 404 — otherwise the
 * response distinguishes "no such org" from "not your org", which is an
 * existence probe for other people's teams.
 *
 * On success attaches `req.organization` and `req.myOrgRole`.
 */
export const orgAccess = (minRole: MinOrgRole): RequestHandler =>
  catchAsync(async (req, _res, next) => {
    if (!req.user) {
      throw AppError.unauthorized("You are not logged in");
    }

    const orgId = resolveOrgId(req);
    if (!orgId) {
      throw AppError.badRequest("No organization was specified for this request");
    }

    const org = await organizationRepository.findById(orgId);
    if (!org) {
      throw AppError.notFound("Organization not found");
    }

    const userId = req.user._id.toString();
    const isPlatformAdmin = req.user.role === "admin";
    const relationship = relationshipTo(org, userId);

    if (!relationship && !isPlatformAdmin) {
      throw AppError.forbidden("You are not a member of this organization");
    }

    // Report the real membership when there is one, so the UI reflects the
    // actual grant; fall back to `admin` for a platform admin passing through.
    const myOrgRole: EffectiveOrgRole = relationship ?? "admin";

    // A platform admin bypasses the rank check entirely, including when their
    // own membership is a lower role than the route demands.
    if (!isPlatformAdmin && RANK[myOrgRole] < RANK[minRole]) {
      const needed = minRole === "orgAdmin" ? "admin" : minRole;
      throw AppError.forbidden(
        `This action requires ${needed} access to the organization`,
      );
    }

    req.organization = org;
    req.myOrgRole = myOrgRole;
    next();
  });

export default orgAccess;
