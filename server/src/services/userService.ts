import type { UserDocument } from "../models/User";
import { userRepository } from "../repositories/userRepository";
import type { UpdateMeInput } from "../schemas/userSchemas";
import { AppError } from "../utils/AppError";

export const userService = {
  /**
   * Updates the caller's own profile. `role` is not reachable from here - the
   * repository's update type excludes password, and this only forwards the
   * three self-service fields, so a user cannot promote themselves.
   */
  async updateMe(userId: string, updates: UpdateMeInput): Promise<UserDocument> {
    const user = await userRepository.updateById(userId, updates);

    if (!user) {
      throw AppError.notFound("User not found");
    }

    return user;
  },

  listAll(): Promise<UserDocument[]> {
    return userRepository.findAll();
  },
};

export default userService;
