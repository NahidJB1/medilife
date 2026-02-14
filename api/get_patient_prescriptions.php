<?php
include 'db_connect.php';
header('Content-Type: application/json');

if (!isset($_GET['patient_id'])) {
    echo json_encode([]);
    exit;
}

$patient_id = $_GET['patient_id'];

// Fetch only 'Prescription' type reports for this patient
$sql = "SELECT * FROM reports WHERE patient_id = ? AND report_type = 'Prescription' ORDER BY timestamp DESC";
$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $patient_id);
$stmt->execute();
$result = $stmt->get_result();

$reports = [];
while ($row = $result->fetch_assoc()) {
    $reports[] = $row;
}

echo json_encode($reports);
?>
