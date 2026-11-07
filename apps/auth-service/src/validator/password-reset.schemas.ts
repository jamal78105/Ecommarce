import z from "zod";

export const forgotPassword=
z.object({
    email:z.string().trim().email().max(254)
})
export const resetToken=
z.object({
    token:z.string().min(1).max(512),
    newPassword:z.string("password must be 8 charecter only").min(8)
})