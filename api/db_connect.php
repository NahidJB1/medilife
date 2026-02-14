
<?php
// api/db_connect.php

// Allow access from your website
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

$host = "localhost";
$user = "u629648508_medelife_db"; // Your Hostinger DB Username
$pass = "Medelife_db1"; // Your Hostinger DB Password
$dbname = "u629648508_medelife_db"; // Your Hostinger DB Name

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    die(json_encode(["error" => "Connection failed: " . $conn->connect_error]));
}

// Set charset to handle emojis/special chars
$conn->set_charset("utf8mb4");
?>
