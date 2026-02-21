<?php
include 'db_connect.php';
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$patientId = $input['patientId'] ?? '';

if (empty($patientId)) {
    echo json_encode(['error' => 'No patient ID provided']);
    exit;
}

// 1. Fetch all reports for this patient
$stmt = $conn->prepare("SELECT * FROM reports WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 10"); // Limiting to recent 10 to avoid payload limits
$stmt->bind_param("s", $patientId);
$stmt->execute();
$result = $stmt->get_result();

$parts = [
    ["text" => "You are a professional medical assistant for MEDeLIFE. Please provide a concise, unified summary of the following patient medical records. Highlight key diagnoses, active medications, and abnormal lab results. Format nicely with HTML tags like <b>, <ul>, and <li>. Do not use Markdown.\n\nHere are the records:\n"]
];

// 2. Process each report (Text or File)
while ($row = $result->fetch_assoc()) {
    $date = date("M d, Y", strtotime($row['timestamp']));
    $type = $row['report_type'];
    $docName = $row['doctor_name'] ? "Dr. " . $row['doctor_name'] : "Patient";

    $parts[] = ["text" => "\n--- Record: $type on $date by $docName ---\n"];

    if ($row['is_manual'] == 1 && !empty($row['content'])) {
        // Add written prescription text
        $parts[] = ["text" => "Clinical Notes: " . $row['content'] . "\n"];
    } elseif (!empty($row['file_path'])) {
        // Read uploaded files (Images or PDFs)
        $filePath = "../" . $row['file_path']; // Adjust relative path based on your folder structure
        
        if (file_exists($filePath)) {
            $mimeType = mime_content_type($filePath);
            // Gemini supports pdf, jpeg, png, webp, heic
            $allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
            
            if (in_array($mimeType, $allowedMimes)) {
                $fileData = base64_encode(file_get_contents($filePath));
                $parts[] = [
                    "inlineData" => [
                        "mimeType" => $mimeType,
                        "data" => $fileData
                    ]
                ];
            } else {
                $parts[] = ["text" => "[File attached but format not supported for AI analysis: $mimeType]\n"];
            }
        } else {
             $parts[] = ["text" => "[File not found on server]\n"];
        }
    }
}

// 3. Send to Gemini API
$apiKey = "YOUR_GEMINI_API_KEY"; // Replace with your actual key
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" . $apiKey;

$payload = [
    "contents" => [
        ["parts" => $parts]
    ],
    "generationConfig" => [
        "temperature" => 0.2 // Low temperature for factual medical data
    ]
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>
