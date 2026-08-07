import bcrypt from "bcrypt";
import { Schema, model, type HydratedDocument, type Model } from "mongoose";
import { toJSONOptions } from "./transforms";

export const USER_ROLES = ["admin", "editor", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const THEME_PREFERENCES = ["light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** OWASP-recommended floor; also what Lab 3 used. */
export const BCRYPT_COST = 12;

export interface IUser {
  name: string;
  email: string;
  /** Absent on Google-only accounts, and never selected by default. */
  password?: string;
  role: UserRole;
  themePreference: ThemePreference;
  avatar?: string;
  googleId?: string;
  /** Bumped on logout/password change to invalidate outstanding refresh tokens. */
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserModel = Model<IUser, Record<string, never>, IUserMethods>;
export type UserDocument = HydratedDocument<IUser, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [80, "Name cannot exceed 80 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      // Creates the unique index - do not also set `index: true` or Mongoose
      // warns about a duplicate index.
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      // Google-only accounts have no password. Validation runs before the
      // pre-save hook, so minlength here checks the plaintext, not the hash.
      required: [
        function (this: IUser) {
          return !this.googleId;
        },
        "Password is required",
      ],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: [...USER_ROLES],
        message: "Role must be one of: admin, editor, viewer",
      },
      default: "editor",
    },
    themePreference: {
      type: String,
      enum: {
        values: [...THEME_PREFERENCES],
        message: "Theme preference must be either light or dark",
      },
      default: "light",
    },
    avatar: { type: String, trim: true },
    googleId: {
      type: String,
      // sparse: only documents that have the field participate, so many
      // password-only users can coexist without colliding on `null`.
      unique: true,
      sparse: true,
    },
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    // tokenVersion is internal session-invalidation state - the client has no
    // use for it and exposing it advertises how revocation works.
    toJSON: toJSONOptions(["password", "tokenVersion"]),
    toObject: toJSONOptions(["password", "tokenVersion"]),
  },
);

userSchema.pre("save", async function hashPassword(next) {
  // Only on create or an actual password change - otherwise every unrelated
  // save would re-hash the stored hash and lock the user out.
  if (!this.isModified("password") || !this.password) return next();

  this.password = await bcrypt.hash(this.password, BCRYPT_COST);
  next();
});

userSchema.methods.comparePassword = async function comparePassword(
  candidate: string,
): Promise<boolean> {
  // Fails closed when the document was loaded without `.select("+password")`
  // or belongs to a Google-only account.
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const User = model<IUser, UserModel>("User", userSchema);

export default User;
