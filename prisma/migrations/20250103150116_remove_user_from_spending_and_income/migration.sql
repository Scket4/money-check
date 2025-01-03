/*
  Warnings:

  - You are about to drop the column `userId` on the `Income` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Spending` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Income" DROP CONSTRAINT "Income_userId_fkey";

-- DropForeignKey
ALTER TABLE "Spending" DROP CONSTRAINT "Spending_userId_fkey";

-- AlterTable
ALTER TABLE "Income" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Spending" DROP COLUMN "userId";
