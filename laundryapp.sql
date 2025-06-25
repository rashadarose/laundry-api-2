-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 25, 2025 at 03:41 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.1.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `laundryapp`
--

-- --------------------------------------------------------

--
-- Table structure for table `pickup_orders`
--

CREATE TABLE `pickup_orders` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `address` varchar(255) NOT NULL,
  `pickup_date` date NOT NULL,
  `pickup_time` time NOT NULL,
  `load_amount` int(11) NOT NULL CHECK (`load_amount` between 1 and 20),
  `dropoff_time` time NOT NULL,
  `price` int(11) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pickup_orders`
--

INSERT INTO `pickup_orders` (`id`, `user_id`, `name`, `address`, `pickup_date`, `pickup_time`, `load_amount`, `dropoff_time`, `price`, `created_at`) VALUES
(2, 1, 'Jane Smith', '123 Main St, Cityville', '2025-06-13', '09:00:00', 2, '13:00:00', 0, '2025-06-12 22:05:20'),
(3, 2, 'Jane Smith', '123 Main St, Cityville', '2025-06-13', '09:00:00', 2, '13:00:00', 0, '2025-06-12 22:27:34'),
(4, 3, 'Rashad Rose', '1818 Fannin Speedway', '2025-06-20', '06:30:00', 1, '16:00:00', 0, '2025-06-12 22:28:17'),
(5, 5, 'Rashad Rose', '1818 Fannin Speedway', '2025-06-28', '00:30:00', 2, '05:00:00', 40, '2025-06-13 04:06:06'),
(14, 5, 'Roman', '8809 Hammerton way', '2025-06-20', '01:30:00', 1, '06:30:00', 20, '2025-06-13 04:33:25'),
(17, 5, 'Roman', '8809 Hammerton way', '2025-06-20', '01:30:00', 1, '06:30:00', 20, '2025-06-13 04:34:13'),
(18, 5, 'Roman', '8809 Hammerton way', '2025-06-20', '01:30:00', 1, '06:30:00', 20, '2025-06-13 04:35:14'),
(19, 5, 'Roman', '8809 Hammerton way', '2025-06-20', '01:30:00', 4, '06:30:00', 80, '2025-06-13 04:35:27'),
(20, 5, 'Roman', '8809 Hammerton way', '2025-06-20', '01:30:00', 1, '06:30:00', 20, '2025-06-13 05:07:27'),
(21, 5, 'Tom Anders', '222 Kimberly Way', '2025-06-26', '06:30:00', 3, '11:30:00', 60, '2025-06-13 13:41:04'),
(22, 1, 'Dr. IQ', '201 Med Center', '2025-06-17', '06:00:00', 1, '14:00:00', 20, '2025-06-13 13:42:54'),
(25, 5, 'Roman', '1818 Fannin Speedway', '2025-06-21', '04:30:00', 1, '10:00:00', 20, '2025-06-13 13:46:06'),
(26, 4, 'Rashad Rose', '8809 Hammerton way', '2025-06-19', '02:30:00', 2, '12:30:00', 40, '2025-06-13 21:09:43'),
(27, 4, 'Rashad Rose', '8809 Hammerton way', '2025-06-19', '05:30:00', 4, '14:30:00', 80, '2025-06-13 21:15:21'),
(28, 4, 'Roman', '201 Med Center', '2025-06-18', '05:30:00', 1, '13:30:00', 20, '2025-06-13 21:16:52'),
(29, 3, 'Rashad Alfonzo Rose', '1818 Fannin Speedway', '2025-06-18', '04:30:00', 1, '14:00:00', 20, '2025-06-13 21:18:40'),
(30, 4, 'Johnny', '8080 Dang Drive', '2025-06-30', '05:00:00', 1, '14:00:00', 20, '2025-06-13 22:03:26'),
(31, 2, 'Johnny', '1818 Fannin Speedway', '2025-06-30', '05:30:00', 1, '15:00:00', 20, '2025-06-14 00:16:33'),
(32, 4, 'Johnny', '1818 Fannin Speedway', '2025-06-30', '07:30:00', 1, '20:00:00', 20, '2025-06-14 01:45:30'),
(33, 5, 'Johnny', '1818 Fannin Speedway', '2025-06-30', '01:00:00', 1, '06:00:00', 20, '2025-06-15 11:12:24');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `has_visited` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `phone`, `email`, `password_hash`, `created_at`, `has_visited`) VALUES
(1, 'Rashad', '9737528237', 'rashad@gmail.com', 'password', '2025-06-11 23:10:29', 0),
(2, 'Guest', '0000000000', 'guest@foldngo.com', 'password', '2025-06-11 23:22:35', 0),
(3, 'John Doe', '1234567890', 'john@example.com', 'hashedword', '2025-06-11 23:54:51', 0),
(4, 'Rashad Rose', '9737528237', 'ralfonzoro@gmail.com', 'sadasdas', '2025-06-11 23:59:28', 1),
(5, 'Johnny', '8537039812', 'johnny@yahoo.com', 'johnjohnny22', '2025-06-12 01:50:56', 0);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `pickup_orders`
--
ALTER TABLE `pickup_orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `pickup_orders`
--
ALTER TABLE `pickup_orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `pickup_orders`
--
ALTER TABLE `pickup_orders`
  ADD CONSTRAINT `pickup_orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
