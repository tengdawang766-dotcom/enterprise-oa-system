-- DropIndex
DROP INDEX `announcement_reads_user_id_fkey` ON `announcement_reads`;

-- DropIndex
DROP INDEX `announcements_publisher_id_fkey` ON `announcements`;

-- DropIndex
DROP INDEX `leave_action_logs_operator_id_fkey` ON `leave_action_logs`;

-- DropIndex
DROP INDEX `leave_requests_applicant_id_fkey` ON `leave_requests`;

-- DropIndex
DROP INDEX `leave_requests_approver_id_fkey` ON `leave_requests`;

-- DropIndex
DROP INDEX `leave_requests_submitted_department_id_fkey` ON `leave_requests`;

-- DropIndex
DROP INDEX `users_department_id_fkey` ON `users`;

-- AlterTable
ALTER TABLE `knowledge_articles` MODIFY `status` ENUM('DRAFT', 'PUBLISHED', 'WITHDRAWN', 'TAKEN_DOWN', 'PENDING_REVIEW') NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE `knowledge_comments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `article_id` INTEGER NOT NULL,
    `author_id` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `deleted_by_id` INTEGER NULL,
    `delete_type` ENUM('SELF', 'ADMIN') NULL,
    `delete_reason` VARCHAR(500) NULL,

    INDEX `knowledge_comments_article_id_created_at_idx`(`article_id`, `created_at`),
    INDEX `knowledge_comments_author_id_created_at_idx`(`author_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_article_likes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `article_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `knowledge_article_likes_user_id_idx`(`user_id`),
    UNIQUE INDEX `knowledge_article_likes_article_id_user_id_key`(`article_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_article_favorites` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `article_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `knowledge_article_favorites_user_id_created_at_idx`(`user_id`, `created_at`),
    UNIQUE INDEX `knowledge_article_favorites_article_id_user_id_key`(`article_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_moderation_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `article_id` INTEGER NOT NULL,
    `operator_id` INTEGER NOT NULL,
    `action` ENUM('TAKE_DOWN', 'REVIEW_SUBMITTED', 'RESTORE_APPROVED', 'RESTORE_REJECTED', 'COMMENT_REMOVED') NOT NULL,
    `reason` VARCHAR(500) NULL,
    `article_status_before` VARCHAR(30) NOT NULL,
    `article_status_after` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `knowledge_moderation_logs_article_id_created_at_idx`(`article_id`, `created_at`),
    INDEX `knowledge_moderation_logs_operator_id_created_at_idx`(`operator_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_manager_user_id_fkey` FOREIGN KEY (`manager_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcement_reads` ADD CONSTRAINT `announcement_reads_announcement_id_fkey` FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcement_reads` ADD CONSTRAINT `announcement_reads_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_applicant_id_fkey` FOREIGN KEY (`applicant_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_approver_id_fkey` FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_submitted_department_id_fkey` FOREIGN KEY (`submitted_department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_action_logs` ADD CONSTRAINT `leave_action_logs_leave_request_id_fkey` FOREIGN KEY (`leave_request_id`) REFERENCES `leave_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_action_logs` ADD CONSTRAINT `leave_action_logs_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_articles` ADD CONSTRAINT `knowledge_articles_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `knowledge_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_articles` ADD CONSTRAINT `knowledge_articles_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_comments` ADD CONSTRAINT `knowledge_comments_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_comments` ADD CONSTRAINT `knowledge_comments_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_comments` ADD CONSTRAINT `knowledge_comments_deleted_by_id_fkey` FOREIGN KEY (`deleted_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_article_likes` ADD CONSTRAINT `knowledge_article_likes_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_article_likes` ADD CONSTRAINT `knowledge_article_likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_article_favorites` ADD CONSTRAINT `knowledge_article_favorites_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_article_favorites` ADD CONSTRAINT `knowledge_article_favorites_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_moderation_logs` ADD CONSTRAINT `knowledge_moderation_logs_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_moderation_logs` ADD CONSTRAINT `knowledge_moderation_logs_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
