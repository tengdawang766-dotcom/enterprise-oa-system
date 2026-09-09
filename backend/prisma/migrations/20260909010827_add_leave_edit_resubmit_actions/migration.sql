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
ALTER TABLE `leave_action_logs` MODIFY `action` ENUM('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'EDITED', 'RESUBMITTED') NOT NULL;

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
