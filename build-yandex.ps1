# Скрипт сборки для Яндекс Игр (PowerShell)

Write-Host "🚀 Подготовка сборки для Яндекс Игр..." -ForegroundColor Cyan

# Создаем директорию сборки
$BUILD_DIR = "build-yandex"
if (Test-Path $BUILD_DIR) {
    Remove-Item -Recurse -Force $BUILD_DIR
}
New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null

Write-Host "📦 Копируем файлы..." -ForegroundColor Yellow

# Основные файлы
$files = @(
    "index.html",
    "style.css",
    "client.js",
    "auth-client.js",
    "yandex-games.js"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Copy-Item $file $BUILD_DIR/
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  $file не найден" -ForegroundColor Yellow
    }
}

# Копируем изображения
$imageFiles = @("icon.png", "bg_orange.jpg", "normal.png")
foreach ($img in $imageFiles) {
    if (Test-Path $img) {
        Copy-Item $img $BUILD_DIR/
        Write-Host "  ✅ $img" -ForegroundColor Green
    }
}

# Копируем аудио
$audioFiles = Get-ChildItem -Filter "*.mp3"
foreach ($audio in $audioFiles) {
    Copy-Item $audio.Name $BUILD_DIR/
    Write-Host "  ✅ $($audio.Name)" -ForegroundColor Green
}

# Копируем манифест
New-Item -ItemType Directory -Path "$BUILD_DIR/yandex-games" -Force | Out-Null
Copy-Item "yandex-games/manifest.yaml" "$BUILD_DIR/yandex-games/"
Write-Host "  ✅ yandex-games/manifest.yaml" -ForegroundColor Green

Write-Host ""
Write-Host "📦 Создаем ZIP архив..." -ForegroundColor Yellow

# Создаем имя архива с датой
$timestamp = Get-Date -Format "yyyyMMdd"
$archiveName = "orca-clicker-yandex-$timestamp.zip"

# Создаем ZIP
Compress-Archive -Path "$BUILD_DIR\*" -DestinationPath $archiveName -Force

Write-Host ""
Write-Host "🎉 Готово!" -ForegroundColor Green
Write-Host "📁 Архив: $archiveName" -ForegroundColor White
Write-Host "📂 Расположение: $(Get-Location)\$archiveName" -ForegroundColor White

# Показываем размер
$size = (Get-Item $archiveName).Length / 1KB
Write-Host "📊 Размер: $([math]::Round($size, 2)) KB" -ForegroundColor Cyan

# Список файлов
Write-Host ""
Write-Host "📋 Содержимое архива:" -ForegroundColor Yellow
$zip = [System.IO.Compression.ZipFile]::OpenRead((Get-Location).Path + "\" + $archiveName)
$zip.Entries | Select-Object FullName | Format-Table -AutoSize
$zip.Dispose()

Write-Host ""
Write-Host "✅ Сборка завершена! Можно загружать в консоль Яндекс Игр" -ForegroundColor Green
