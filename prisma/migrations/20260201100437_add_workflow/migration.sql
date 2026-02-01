-- CreateTable
CREATE TABLE `Workflow` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` ENUM('PENDING', 'REJECTED', 'ACTIVE', 'RETURNED') NOT NULL DEFAULT 'PENDING',
    `description` VARCHAR(191) NOT NULL,
    `applicantDiscordId` VARCHAR(191) NOT NULL,
    `organizerDiscordId` VARCHAR(191) NOT NULL,
    `mcVersion` VARCHAR(191) NOT NULL,
    `periodDays` INTEGER NOT NULL,
    `pteroServerId` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowPanelUser` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workflowId` INTEGER NOT NULL,
    `discordId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PterodactylUser` (
    `discordId` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PterodactylUser_username_key`(`username`),
    UNIQUE INDEX `PterodactylUser_email_key`(`email`),
    PRIMARY KEY (`discordId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WorkflowPanelUser` ADD CONSTRAINT `WorkflowPanelUser_workflowId_fkey` FOREIGN KEY (`workflowId`) REFERENCES `Workflow`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
