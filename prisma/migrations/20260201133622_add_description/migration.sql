/*
  Warnings:

  - Added the required column `name` to the `Workflow` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Workflow` ADD COLUMN `name` VARCHAR(191) NOT NULL,
    MODIFY `description` VARCHAR(191) NULL,
    MODIFY `mcVersion` VARCHAR(191) NULL;
