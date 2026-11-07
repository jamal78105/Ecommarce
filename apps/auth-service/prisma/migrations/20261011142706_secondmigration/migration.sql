/*
  Warnings:

  - You are about to drop the column `tokenHash` on the `refresh_tokens` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "refresh_tokens_tokenHash_key";

-- AlterTable
ALTER TABLE "refresh_tokens" DROP COLUMN "tokenHash";
