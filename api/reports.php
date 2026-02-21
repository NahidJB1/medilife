<?php
include 'db_connect.php';
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_REQUEST['action'] ?? '';

// --- GET REQUESTS (Fetching Data) ---
if ($method === 'GET') {
    $patient_id = $_GET['patient_id'] ?? '';
    $type = $_GET['type'] ?? '';        // e.g., 'Prescription'
    $uploader = $_GET['uploader'] ?? ''; // e.g., 'patient' or 'doctor'

    // Base SQL
    $sql = "SELECT * FROM reports WHERE patient_id = '$patient_id'";

    // Add filters if they exist
    if (!empty($type)) {
        $sql .= " AND report_type = '$type'";
    }
    if (!empty($uploader)) {
        $sql .= " AND uploaded_by = '$uploader'";
    }

    $sql .= " ORDER BY timestamp DESC";

    $result = $conn->query($sql);
    
    $data = [];
    while ($row = $result->fetch_assoc()) {
        // Add a clean date for JS
        $row['formatted_date'] = date("M d, Y", strtotime($row['timestamp']));
        $data[] = $row;
    }
    echo json_encode($data);
}

// --- POST REQUESTS (Saving Data) ---
elseif ($method === 'POST') {
    
    // 1. UPLOAD FILE (Used by both Doctor & Patient)
    if ($action == 'upload') {
        $pid = $_POST['patientId'];
        $did = $_POST['doctorId'] ?? '';
        $dname = $_POST['doctorName'] ?? '';
        $type = $_POST['reportType']; // 'Prescription', 'Report', or 'Patient Upload'
        $cat = $_POST['docCategory'] ?? $type;
        $by = $_POST['uploadedBy']; // 'doctor' or 'patient'

        if (isset($_FILES['file'])) {
            $target_dir = "../uploads/";
            if (!file_exists($target_dir)) mkdir($target_dir, 0777, true);

            $fileName = time() . "_" . basename($_FILES["file"]["name"]);
            $target_file = $target_dir . $fileName;

            if (move_uploaded_file($_FILES["file"]["tmp_name"], $target_file)) {
                // Store path relative to API or Root
                $dbPath = "uploads/" . $fileName;
                
                $stmt = $conn->prepare("INSERT INTO reports (patient_id, doctor_id, doctor_name, report_type, doc_category, file_path, uploaded_by, is_manual) VALUES (?, ?, ?, ?, ?, ?, ?, 0)");
                $stmt->bind_param("sssssss", $pid, $did, $dname, $type, $cat, $dbPath, $by);
                
                if($stmt->execute()) echo json_encode(["status" => "success"]);
                else echo json_encode(["status" => "error", "message" => $stmt->error]);
            } else {
                echo json_encode(["status" => "error", "message" => "File move failed"]);
            }
        } else {
            echo json_encode(["status" => "error", "message" => "No file sent"]);
        }
    }

    // 2. MANUAL PRESCRIPTION (Doctor Only)
    elseif ($action == 'manual') {
        $pid = $_POST['patientId'];
        $did = $_POST['doctorId'];
        $dname = $_POST['doctorName'];
        $content = $_POST['content'];
        $docDetails = $_POST['doctorDetails']; // JSON string
        
        $stmt = $conn->prepare("INSERT INTO reports (patient_id, doctor_id, doctor_name, report_type, doc_category, uploaded_by, is_manual, content, doctor_details) VALUES (?, ?, ?, 'Prescription', 'Prescription', 'doctor', 1, ?, ?)");
        // Removed the extra 's' from the bind_param string to match the 5 variables
        $stmt->bind_param("sssss", $pid, $did, $dname, $content, $docDetails);
        
        if($stmt->execute()) echo json_encode(["status" => "success"]);
        else echo json_encode(["status" => "error", "message" => $stmt->error]);
    }
}

// Add this inside the "POST REQUESTS" section of reports.php

elseif ($action == 'generate_summary') {
    $patient_id = $_POST['patientId'];
    
    // 1. Fetch all records for this patient to summarize
    $sql = "SELECT report_type, doc_category, content, doctor_name, timestamp 
            FROM reports WHERE patient_id = '$patient_id' 
            ORDER BY timestamp DESC LIMIT 10";
    $result = $conn->query($sql);
    
    $recordsText = "";
    while ($row = $result->fetch_assoc()) {
        $content = $row['is_manual'] == 1 ? $row['content'] : "File: " . $row['doc_category'];
        $recordsText .= "Date: {$row['timestamp']} | Type: {$row['report_type']} | Details: {$content}\n";
    }

?>
