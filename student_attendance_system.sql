-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 30, 2025 at 06:10 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `student_attendance_system`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin`
--

CREATE TABLE `admin` (
  `admin_id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admin`
--

INSERT INTO `admin` (`admin_id`, `username`, `password`, `email`, `reset_token`, `reset_token_expires`, `created_at`, `updated_at`) VALUES
(1, 'admin', 'admin123', 'admin@example.com', NULL, NULL, '2025-05-27 06:45:53', '2025-05-27 06:45:53');

-- --------------------------------------------------------

--
-- Table structure for table `announcements`
--

CREATE TABLE `announcements` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `date_created` timestamp NOT NULL DEFAULT current_timestamp(),
  `content` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `announcements`
--

INSERT INTO `announcements` (`id`, `title`, `date_created`, `content`) VALUES
(9, 'project', '2025-05-29 16:37:30', 'All students must submit their assignments by Friday at sharp 7:00 AM');

-- --------------------------------------------------------

--
-- Table structure for table `attendances`
--

CREATE TABLE `attendances` (
  `attendance_id` int(11) NOT NULL,
  `stu_id` int(11) NOT NULL,
  `routine_id` int(11) NOT NULL,
  `subject` varchar(100) DEFAULT NULL,
  `class_date` date DEFAULT NULL,
  `class` varchar(50) DEFAULT NULL,
  `present` tinyint(1) DEFAULT 0,
  `remarks` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `captures`
--

CREATE TABLE `captures` (
  `capture_id` int(11) NOT NULL,
  `attendance_id` int(11) NOT NULL,
  `routine_id` int(11) DEFAULT NULL,
  `captured_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `photo_path` varchar(255) DEFAULT NULL,
  `match_result` tinyint(1) DEFAULT NULL COMMENT 'TRUE = Matched, FALSE = Not matched'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `class_routine`
--

CREATE TABLE `class_routine` (
  `id` int(11) NOT NULL,
  `semester` int(11) NOT NULL CHECK (`semester` between 1 and 8),
  `course_id` varchar(20) NOT NULL,
  `subject_name` varchar(100) NOT NULL,
  `day_of_week` enum('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday') NOT NULL,
  `course_time` time NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `class_routine`
--

INSERT INTO `class_routine` (`id`, `semester`, `course_id`, `subject_name`, `day_of_week`, `course_time`, `created_at`) VALUES
(2, 2, 'CS102', 'Data Structure', 'Tuesday', '13:10:00', '2025-05-29 17:25:25'),
(3, 2, '101', 'dot net', 'Sunday', '23:11:00', '2025-05-29 17:26:10'),
(4, 6, '102', 'Python', 'Sunday', '14:11:00', '2025-05-29 17:26:36'),
(5, 4, '1010', 'Networking', 'Sunday', '08:26:00', '2025-05-29 17:41:55'),
(6, 6, '1020', 'English', 'Wednesday', '07:25:00', '2025-05-30 01:40:25'),
(7, 7, '1020', 'Computer', 'Sunday', '07:40:00', '2025-05-30 01:55:27');

-- --------------------------------------------------------

--
-- Table structure for table `manage`
--

CREATE TABLE `manage` (
  `admin_id` int(11) NOT NULL,
  `routine_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `message` varchar(255) NOT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `message`, `is_read`, `created_at`) VALUES
(24, 'New student registered: ram (ram@gmail.com)', 1, '2025-05-29 17:38:45'),
(25, 'New student registration: test04', 1, '2025-05-30 00:14:26'),
(26, 'New student registration: bishal', 1, '2025-05-30 01:37:16'),
(27, 'New student registration: demo2', 1, '2025-05-30 01:52:35');

-- --------------------------------------------------------

--
-- Table structure for table `routine`
--

CREATE TABLE `routine` (
  `routine_id` int(11) NOT NULL,
  `class` varchar(50) DEFAULT NULL,
  `subject` varchar(100) DEFAULT NULL,
  `stu_id` int(11) DEFAULT NULL,
  `auto_timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  `automatic_schedule_image_capture` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student`
--

CREATE TABLE `student` (
  `stu_id` int(11) NOT NULL,
  `Stu_name` varchar(100) DEFAULT NULL,
  `Stu_Address` text DEFAULT NULL,
  `Stu_contact` varchar(15) DEFAULT NULL,
  `Stu_password` varchar(100) DEFAULT NULL,
  `semester` varchar(10) DEFAULT NULL,
  `Stu_email` varchar(100) DEFAULT NULL,
  `photo_path` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `student`
--

INSERT INTO `student` (`stu_id`, `Stu_name`, `Stu_Address`, `Stu_contact`, `Stu_password`, `semester`, `Stu_email`, `photo_path`, `created_at`, `updated_at`) VALUES
(55, 'nischal bhattarai', 'dhunibeshi-02,dhading', '1234567890', 'nischal123', '6', 'nischal007@gmail.com', 'uploads/student_nischalgmail.com_git-photo.jpg', '2025-05-28 17:23:28', '2025-05-28 17:28:39'),
(56, 'test', 'test', '1122334455', 'test@1234', '6', 'test@gmail.com', 'uploads/student_testgmail.com_yukuna.jpg', '2025-05-28 17:31:03', '2025-05-28 17:31:03'),
(62, 'test09', 'dhading', '9845612300', 'test12345', '3', 'test09@gmail.com', 'uploads\\student_photos\\62_viper.png', '2025-05-28 18:58:24', '2025-05-29 13:49:59'),
(63, 'test10', 'kakani', '1234567890', 'test12345', '8', 'test10@gmail.com', 'uploads\\student_photos\\63_yoru.jpg', '2025-05-28 19:09:56', '2025-05-29 13:52:52'),
(64, 'ramesh kumar', 'kalanki', '9845645644', 'ramesh@123', '3', 'ramesh@gmail.com', 'uploads/student_photos/student_64_omen.jpg', '2025-05-29 15:32:05', '2025-05-29 15:54:33'),
(66, 'test04', 'teku', '1234567890', 'test12345', '3', 'test04@gmail.com', 'uploads/student_photos/student_66_sova.png', '2025-05-30 00:14:26', '2025-05-30 00:15:50'),
(67, 'bishal', 'teku', '0123456120', 'bishal@123', '3', 'bishal@gmail.com', 'uploads/student_photos/student_67_sova.png', '2025-05-30 01:37:16', '2025-05-30 14:53:27'),
(68, 'demo2', 'kalanki', '1234567890', 'demo@1234', '7', 'demo@gmail.com', 'uploads/student_photos/student_68_reyna.jpg', '2025-05-30 01:52:35', '2025-05-30 01:54:51');

-- --------------------------------------------------------

--
-- Table structure for table `upcoming_classes`
--

CREATE TABLE `upcoming_classes` (
  `id` int(11) NOT NULL,
  `class_name` varchar(100) NOT NULL,
  `day_of_week` varchar(10) NOT NULL,
  `time` time NOT NULL,
  `faculty` varchar(100) NOT NULL,
  `semester` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `upcoming_classes`
--

INSERT INTO `upcoming_classes` (`id`, `class_name`, `day_of_week`, `time`, `faculty`, `semester`, `created_at`) VALUES
(1, 'java', 'Tue', '07:00:00', 'bca', '6', '2025-05-29 15:30:58'),
(3, 'matrix', 'Tue', '08:00:00', 'bca', '7', '2025-05-30 00:12:46'),
(4, 'Networking', 'Fri', '08:00:00', 'BCA', '8', '2025-05-30 14:59:25');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin`
--
ALTER TABLE `admin`
  ADD PRIMARY KEY (`admin_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `announcements`
--
ALTER TABLE `announcements`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `attendances`
--
ALTER TABLE `attendances`
  ADD PRIMARY KEY (`attendance_id`),
  ADD UNIQUE KEY `unique_attendance_entry` (`stu_id`,`routine_id`,`class_date`),
  ADD KEY `fk_attendances_routine` (`routine_id`);

--
-- Indexes for table `captures`
--
ALTER TABLE `captures`
  ADD PRIMARY KEY (`capture_id`),
  ADD KEY `fk_captures_attendance` (`attendance_id`),
  ADD KEY `fk_captures_routine` (`routine_id`);

--
-- Indexes for table `class_routine`
--
ALTER TABLE `class_routine`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `manage`
--
ALTER TABLE `manage`
  ADD PRIMARY KEY (`admin_id`,`routine_id`),
  ADD KEY `routine_id` (`routine_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `routine`
--
ALTER TABLE `routine`
  ADD PRIMARY KEY (`routine_id`),
  ADD KEY `stu_id` (`stu_id`);

--
-- Indexes for table `student`
--
ALTER TABLE `student`
  ADD PRIMARY KEY (`stu_id`);

--
-- Indexes for table `upcoming_classes`
--
ALTER TABLE `upcoming_classes`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin`
--
ALTER TABLE `admin`
  MODIFY `admin_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;

--
-- AUTO_INCREMENT for table `announcements`
--
ALTER TABLE `announcements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `attendances`
--
ALTER TABLE `attendances`
  MODIFY `attendance_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `captures`
--
ALTER TABLE `captures`
  MODIFY `capture_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `class_routine`
--
ALTER TABLE `class_routine`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `routine`
--
ALTER TABLE `routine`
  MODIFY `routine_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student`
--
ALTER TABLE `student`
  MODIFY `stu_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=69;

--
-- AUTO_INCREMENT for table `upcoming_classes`
--
ALTER TABLE `upcoming_classes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `attendances`
--
ALTER TABLE `attendances`
  ADD CONSTRAINT `fk_attendances_routine` FOREIGN KEY (`routine_id`) REFERENCES `routine` (`routine_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_attendances_student` FOREIGN KEY (`stu_id`) REFERENCES `student` (`stu_id`) ON DELETE CASCADE;

--
-- Constraints for table `captures`
--
ALTER TABLE `captures`
  ADD CONSTRAINT `fk_captures_attendance` FOREIGN KEY (`attendance_id`) REFERENCES `attendances` (`attendance_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_captures_routine` FOREIGN KEY (`routine_id`) REFERENCES `routine` (`routine_id`) ON DELETE SET NULL;

--
-- Constraints for table `manage`
--
ALTER TABLE `manage`
  ADD CONSTRAINT `manage_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `admin` (`admin_id`),
  ADD CONSTRAINT `manage_ibfk_2` FOREIGN KEY (`routine_id`) REFERENCES `routine` (`routine_id`);

--
-- Constraints for table `routine`
--
ALTER TABLE `routine`
  ADD CONSTRAINT `routine_ibfk_1` FOREIGN KEY (`stu_id`) REFERENCES `student` (`stu_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
