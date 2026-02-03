/*
  Warnings:

  - You are about to drop the `WorkflowPanelUser` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `PterodactylUser` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `WorkflowPanelUser` DROP FOREIGN KEY `WorkflowPanelUser_workflowId_fkey`;

-- AlterTable
-- First, make username and email nullable
ALTER TABLE `PterodactylUser` MODIFY `username` VARCHAR(191) NULL,
    MODIFY `email` VARCHAR(191) NULL;

-- Add new columns with temporary default values
ALTER TABLE `PterodactylUser` ADD COLUMN `registered` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT '1970-01-01 00:00:00';

-- Copy createdAt to updatedAt for existing records
UPDATE `PterodactylUser` SET `updatedAt` = `createdAt`;

-- Set registered flag to true for existing PterodactylUser records
UPDATE `PterodactylUser` SET `registered` = true WHERE `username` IS NOT NULL AND `email` IS NOT NULL;

-- CreateTable
CREATE TABLE `_PterodactylUserToWorkflow` (
    `A` VARCHAR(191) NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_PterodactylUserToWorkflow_AB_unique`(`A`, `B`),
    INDEX `_PterodactylUserToWorkflow_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate data from WorkflowPanelUser to _PterodactylUserToWorkflow
-- Only migrate users that exist in PterodactylUser table
INSERT INTO `_PterodactylUserToWorkflow` (`A`, `B`)
SELECT DISTINCT wpu.`discordId`, wpu.`workflowId`
FROM `WorkflowPanelUser` wpu
INNER JOIN `PterodactylUser` pu ON wpu.`discordId` = pu.`discordId`;

-- DropTable
DROP TABLE `WorkflowPanelUser`;

-- AddForeignKey
ALTER TABLE `_PterodactylUserToWorkflow` ADD CONSTRAINT `_PterodactylUserToWorkflow_A_fkey` FOREIGN KEY (`A`) REFERENCES `PterodactylUser`(`discordId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PterodactylUserToWorkflow` ADD CONSTRAINT `_PterodactylUserToWorkflow_B_fkey` FOREIGN KEY (`B`) REFERENCES `Workflow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
