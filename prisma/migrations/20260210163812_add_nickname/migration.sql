-- AlterTable
ALTER TABLE `PterodactylUser` ADD COLUMN `nickname` VARCHAR(191) NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- Copy username to nickname for existing records
UPDATE `PterodactylUser` SET `nickname` = `username` WHERE `username` IS NOT NULL;
