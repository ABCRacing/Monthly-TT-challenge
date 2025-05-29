# Define the source URL and destination path
$sourceUrl = "https://ams2leaderboards.neocities.org/data/boards/F3%20Brasil,%20Jacarepagu%C3%A1%20Historic%202012%20SCB.json"
$destinationPath = ".\data\leaderboard_filtered.json"

# Download the JSON data
try {
    $response = Invoke-WebRequest -Uri $sourceUrl -UseBasicParsing
    $jsonData = $response.Content | ConvertFrom-Json
} catch {
    Write-Error "Failed to download or parse JSON data: $_"
    exit 1
}

# Process the data
$processedData = @()
foreach ($entry in $jsonData) {
    $processedData += [PSCustomObject]@{
        Name     = $entry.Name
        LapTime  = $entry.LapTime
        Sector1  = $entry.Sector1
        Sector2  = $entry.Sector2
        Sector3  = $entry.Sector3
        Gap      = $entry.Gap
    }
}

# Convert the processed data to JSON
$processedJson = $processedData | ConvertTo-Json -Depth 3

# Save the processed JSON to the destination path
try {
    $processedJson | Set-Content -Path $destinationPath -Encoding UTF8
    Write-Host "Leaderboard updated successfully at $destinationPath"
} catch {
    Write-Error "Failed to write JSON data to file: $_"
    exit 1
}
