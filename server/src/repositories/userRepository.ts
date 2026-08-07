import type { Types } from "mongoose";
import { User, type IUser, type UserDocument } from "../models/User";

export type UserId = string | Types.ObjectId;

export interface CreateUserInput {
  name: string;
  email: string;
  password?: string;
  role?: IUser["role"];
  themePreference?: IUser["themePreference"];
  avatar?: string;
  googleId?: string;
}

/**
 * Fields a client may change on an existing user.
 *
 * `password` is deliberately excluded: findByIdAndUpdate bypasses the
 * pre-save hook, so routing a password through here would store it in
 * plaintext. Use setPassword() instead.
 */
export type UpdateUserInput = Partial<
  Pick<IUser, "name" | "themePreference" | "avatar" | "role">
>;

export const userRepository = {
  create(data: CreateUserInput): Promise<UserDocument> {
    return User.create(data);
  },

  findById(id: UserId): Promise<UserDocument | null> {
    return User.findById(id).exec();
  },

  findByEmail(email: string): Promise<UserDocument | null> {
    return User.findOne({ email: email.toLowerCase() }).exec();
  },

  /** Includes the hash - only for login. `password` is `select: false`. */
  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return User.findOne({ email: email.toLowerCase() })
      .select("+password")
      .exec();
  },

  findByIdWithPassword(id: UserId): Promise<UserDocument | null> {
    return User.findById(id).select("+password").exec();
  },

  findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return User.findOne({ googleId }).exec();
  },

  existsByEmail(email: string): Promise<boolean> {
    return User.exists({ email: email.toLowerCase() }).then(Boolean);
  },

  findAll(): Promise<UserDocument[]> {
    return User.find().sort({ createdAt: -1 }).exec();
  },

  updateById(id: UserId, updates: UpdateUserInput): Promise<UserDocument | null> {
    return User.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).exec();
  },

  /**
   * Sets a new password through save() so the pre-save bcrypt hook runs.
   * Returns null when the user does not exist.
   */
  async setPassword(id: UserId, plainPassword: string): Promise<UserDocument | null> {
    const user = await User.findById(id).select("+password").exec();
    if (!user) return null;

    user.password = plainPassword;
    await user.save();
    return user;
  },

  /** Invalidates every outstanding refresh token for this user. */
  async incrementTokenVersion(id: UserId): Promise<UserDocument | null> {
    return User.findByIdAndUpdate(
      id,
      { $inc: { tokenVersion: 1 } },
      { new: true },
    ).exec();
  },

  /** Links a Google identity to an existing (email-matched) account. */
  linkGoogleId(id: UserId, googleId: string): Promise<UserDocument | null> {
    return User.findByIdAndUpdate(id, { googleId }, { new: true }).exec();
  },

  deleteById(id: UserId): Promise<UserDocument | null> {
    return User.findByIdAndDelete(id).exec();
  },
};

export default userRepository;
